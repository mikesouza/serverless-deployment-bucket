const DeploymentBucketPlugin = require('.')
const Serverless = require('serverless/lib/Serverless')
const AwsProvider = jest.genMockFromModule('serverless/lib/plugins/aws/provider/awsProvider')
const CLI = jest.genMockFromModule('serverless/lib/classes/CLI')

describe('DeploymentBucketPlugin', () => {
  let plugin
  let serverless
  let options

  beforeEach(() => {
    serverless = new Serverless()
    serverless.service.service = 'my-service'
    options = {}
    serverless.setProvider('aws', new AwsProvider(serverless))
    serverless.cli = new CLI(serverless)
  })

  describe('constructor', () => {
    beforeEach(() => {
      plugin = new DeploymentBucketPlugin(serverless, options)
    })

    it('should set the provider to instance of AwsProvider', () => {
      expect(plugin.provider).toBeInstanceOf(AwsProvider)
    })

    it('should have access to the serverless instance', () => {
      expect(plugin.serverless).toEqual(serverless)
    })
  })

  describe('without configuration', () => {
    it('should default to empty deploymentBucket config if missing provider deploymentBucketObject', () => {
      serverless.service.provider.deploymentBucketObject = undefined
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.deploymentBucket).toEqual({})
    })

    it('should default to empty config if missing object "custom"', () => {
      serverless.service.custom = undefined
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config).toEqual({})
    })

    it('should default to empty config if missing object "custom.deploymentBucket"', () => {
      serverless.service.custom = {}
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config).toEqual({})
    })

    it('should default to empty config if null object "custom.deploymentBucket"', () => {
      serverless.service.custom = {
        deploymentBucket: null
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config).toEqual({})
    })

    it('should default versioning to false if missing property "custom.deploymentBucket.versioning"', () => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'some-bucket'
      }
      serverless.service.custom = {
        deploymentBucket: {}
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config.versioning).toEqual(false)
    })

    it('should default acceleration to false if missing property "custom.deploymentBucket.acceleration"', () => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'some-bucket'
      }
      serverless.service.custom = {
        deploymentBucket: {}
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config.accelerate).toEqual(false)
    })

    it('should not set hooks if missing property "custom.deploymentBucket.name"', () => {
      serverless.service.provider.deploymentBucketObject = {}
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })

    it('should not set hooks if empty property "custom.deploymentBucket.name"', () => {
      serverless.service.provider.deploymentBucketObject = {
        name: ''
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })
  })

  describe('with configuration enabled = false', () => {
    beforeEach(() => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'some-bucket',
        serverSideEncryption: 'AES256'
      }
      serverless.service.custom = {
        deploymentBucket: {
          enabled: false
        }
      }
      plugin = new DeploymentBucketPlugin(serverless, options)
    })

    it('should not set hooks', () => {
      expect(plugin.hooks).toEqual({})
    })
  })

  describe('with configuration', () => {
    beforeEach(() => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'some-bucket',
        serverSideEncryption: 'AES256'
      }
      plugin = new DeploymentBucketPlugin(serverless, options)
    })

    it('should set config', () => {
      expect(plugin.config).toBeTruthy()
    })

    it('should set hooks', () => {
      expect(plugin.hooks).toHaveProperty('before:aws:common:validate:validate')
    })
  })

  describe('when serverless package', () => {
    it('should not set hooks serverless package command is run', () => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'random-bucket'
      }
      serverless.processedInput = { commands: ['package'] }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })

    it('should set hooks serverless deploy command is run', () => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'random-bucket'
      }
      serverless.processedInput = { commands: ['deploy'] }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).toHaveProperty('before:aws:common:validate:validate')
    })
  })

  describe('applyDeploymentBucket()', () => {
    beforeEach(() => {
      serverless.service.provider.deploymentBucketObject = {
        name: 'some-bucket',
        serverSideEncryption: 'AES256'
      }
      serverless.service.custom = {
        deploymentBucket: {
          versioning: true,
          accelerate: true
        }
      }

      plugin = new DeploymentBucketPlugin(serverless, options)
    })

    it('should log info when using existing deployment bucket', async () => {
      plugin.provider.request.mockResolvedValueOnce({}) // S3.headBucket()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Using deployment bucket'))
    })

    it('should log info when using existing deployment bucket', async () => {
      plugin.provider.request.mockRejectedValueOnce({}) // S3.headBucket()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Creating deployment bucket'))
    })

    it('should log info when SSE is applied to deployment bucket', async () => {
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Applied SSE'))
    })

    it('should log info when versioning is applied to deployment bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Suspended'
        }) // S3.getBucketVersioning()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Enabled versioning'))
    })

    it('should suspend versioning when versioning is not already suspended on deployment bucket', async () => {
      plugin.config.versioning = false
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketVersioning()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Suspended versioning'))
    })

    it('should log info when acceleration is applied to deployment bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketVersioning()
        .mockResolvedValueOnce({
          Status: 'Suspended'
        }) // S3.getBucketAccelerateConfiguration()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Enabled acceleration'))
    })

    it('should suspend acceleration when acceleration is not already suspended on deployment bucket', async () => {
      plugin.config.accelerate = false
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketVersioning()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketAccelerateConfiguration()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Suspended acceleration'))
    })

    it('should log error when exception caught', async () => {
      const spy = jest.spyOn(console, 'error')
      const errorMessage = 'Some AWS provider error'
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockRejectedValueOnce(new Error(errorMessage)) // S3.createBucket()

      await plugin.applyDeploymentBucket()

      expect(spy).toHaveBeenLastCalledWith(expect.stringContaining(errorMessage))
    })

    it('should not enable versioning when versioning is already enabled on deployment bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketVersioning()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Enabled versioning'))
    })

    it('should not enable acceleration when acceleration is already enabled on deployment bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketVersioning()
        .mockResolvedValueOnce({
          Status: 'Enabled'
        }) // S3.getBucketAccelerateConfiguration()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Enabled acceleration'))
    })

    it('should not apply SSE if not configured on provider', async () => {
      plugin.deploymentBucket.serverSideEncryption = undefined
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Applied SSE'))
    })

    it('should wait for created deployment bucket to exist', async () => {
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      const mockWaitFor = jest.fn((state, params, callback) => {
        return {
          promise: jest.fn(() => {
            return new Promise((resolve, reject) => {
              resolve()
            })
          })
        }
      })

      plugin.provider.sdk = {
        S3: jest.fn((credentials) => {
          return {
            waitFor: mockWaitFor
          }
        })
      }

      await plugin.applyDeploymentBucket()

      expect(mockWaitFor).toHaveBeenCalled()
    })

    it('should not apply bucket policy if not configured', async () => {
      plugin.config.policy = undefined
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Applied deployment bucket policy'))
    })

    it('should apply bucket policy if configured', async () => {
      plugin.config.policy = '{}'
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Applied deployment bucket policy'))
    })
  })
})
