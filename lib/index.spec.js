const DeploymentBucketPlugin = require('.')
const Serverless = require('serverless/lib/Serverless')
const util = require('./util')
const AwsProvider = jest.genMockFromModule('serverless/lib/plugins/aws/provider')
const CLI = jest.genMockFromModule('serverless/lib/classes/CLI')

describe('DeploymentBucketPlugin', () => {
  let plugin
  let serverless
  let options
  let deploymentBucketProp

  beforeEach(() => {
    serverless = new Serverless()
    deploymentBucketProp = util.deploymentBucketProperty(serverless.version)
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
      serverless.service.provider[deploymentBucketProp] = undefined
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
      serverless.service.provider[deploymentBucketProp] = {
        name: 'some-bucket'
      }
      serverless.service.custom = {
        deploymentBucket: {}
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config.versioning).toEqual(false)
    })

    it('should default acceleration to false if missing property "custom.deploymentBucket.acceleration"', () => {
      serverless.service.provider[deploymentBucketProp] = {
        name: 'some-bucket'
      }
      serverless.service.custom = {
        deploymentBucket: {}
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.config.accelerate).toEqual(false)
    })

    it('should not set hooks if missing property "custom.deploymentBucket.name"', () => {
      serverless.service.provider[deploymentBucketProp] = {}
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })

    it('should not set hooks if empty property "custom.deploymentBucket.name"', () => {
      serverless.service.provider[deploymentBucketProp] = {
        name: ''
      }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })
  })

  describe('with configuration enabled = false', () => {
    beforeEach(() => {
      serverless.service.provider[deploymentBucketProp] = {
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

  describe('with AES256 configuration', () => {
    beforeEach(() => {
      serverless.service.provider[deploymentBucketProp] = {
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

  describe('with KMS configuration', () => {
    beforeEach(() => {
      serverless.service.provider[deploymentBucketProp] = {
        name: 'some-bucket',
        serverSideEncryption: 'aws:kms',
        kmsKeyID: 'some-key-id'
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
      serverless.service.provider[deploymentBucketProp] = {
        name: 'random-bucket'
      }
      serverless.processedInput = { commands: ['package'] }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).not.toHaveProperty('before:aws:common:validate:validate')
    })

    it('should set hooks serverless deploy command is run', () => {
      serverless.service.provider[deploymentBucketProp] = {
        name: 'random-bucket'
      }
      serverless.processedInput = { commands: ['deploy'] }
      plugin = new DeploymentBucketPlugin(serverless, options)

      expect(plugin.hooks).toHaveProperty('before:aws:common:validate:validate')
    })
  })

  describe('applyDeploymentBucket()', () => {
    beforeEach(() => {
      serverless.service.provider[deploymentBucketProp] = {
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

    it('should apply SSE (AES256) if configured on provider', async () => {
      plugin.deploymentBucket.serverSideEncryption = 'AES256'
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Applied SSE (AES256)'))
    })

    it('should apply SSE (KMS) if configured on provider', async () => {
      plugin.deploymentBucket.serverSideEncryption = 'aws:kms'
      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockRejectedValueOnce({}) // S3.getBucketEncryption()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Applied SSE (aws:kms)'))
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

    it('should not apply bucket tags if not configured', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockRejectedValueOnce({}) // S3.getBucketTagging()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket tags'))
    })

    it('should apply bucket tags if configured', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: [ { Key: 'Environment', Value: 'testing' } ]
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.putBucketTagging()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket tags'))
    })

    it('should not apply bucket tags if no change', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: [ { Key: 'Environment', Value: 'testing' } ]
      }

      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({
          TagSet: [ { Key: 'Environment', Value: 'testing' } ]
        }) // S3.getBucketTagging()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket tags'))
    })

    it('should remove bucket tags if not configured', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({
          TagSet: [ { Key: 'Environment', Value: 'testing' } ]
        }) // S3.getBucketTagging()
        .mockResolvedValueOnce({}) // S3.putBucketTagging()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket tags'))
    })

    it('should not apply bucket public access block if not configured and getPublicAccessBlock() throws exception', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: undefined
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockRejectedValueOnce({}) // S3.getPublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should apply bucket public access block if configured', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: true,
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockResolvedValueOnce({}) // S3.getPublicAccessBlock()
        .mockResolvedValueOnce({}) // S3.putPublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should apply bucket public access block when getPublicAccessBlock() throws exception', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: true,
      }

      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockRejectedValueOnce({}) // S3.putPublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should not apply bucket public access block if no change', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: true
      }

      plugin.provider.request
        .mockResolvedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
          }
        }) // S3.getPublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should remove bucket public access block if not configured', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: undefined
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockResolvedValueOnce({
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
          }
        }) // S3.getPublicAccessBlock()
        .mockResolvedValueOnce({}) // S3.deletePublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should apply bucket public access on new buckets', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: true
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockResolvedValueOnce({}) // S3.putPublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })

    it('should remove bucket public access on new buckets', async () => {
      plugin.config = {
        ...plugin.config,
        accelerate: false,
        versioning: false,
        policy: undefined,
        tags: undefined,
        blockPublicAccess: false
      }

      plugin.provider.request
        .mockRejectedValueOnce({}) // S3.headBucket()
        .mockResolvedValueOnce({}) // S3.createBucket()
        .mockResolvedValueOnce({}) // S3.getBucketEncryption()
        .mockResolvedValueOnce({}) // S3.getBucketVersioning()
        .mockResolvedValueOnce({}) // S3.getBucketAccelerateConfiguration()
        .mockResolvedValueOnce({}) // S3.getBucketTagging()
        .mockResolvedValueOnce({}) // S3.deletePublicAccessBlock()

      await plugin.applyDeploymentBucket()

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(expect.stringContaining('Updated deployment bucket public access block'))
    })
  })
})
