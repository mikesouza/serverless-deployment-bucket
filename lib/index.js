'use strict'

const chalk = require('chalk')
const util = require('./util')

const get = (obj, path, defaultValue) => {
  return path.split('.').filter(Boolean).every(step => !(step && !(obj = obj[step]))) ? obj : defaultValue
}

const getPublicAccessBlock = block => block === true
  ? { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true }
  : { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false }

class DeploymentBucketPlugin {
  constructor(serverless, options) {
    this.serverless = serverless
    this.provider = this.serverless.providers.aws

    const deploymentBucketProp = util.deploymentBucketProperty(this.serverless.version)
    this.deploymentBucket = get(this.serverless.service, `provider.${deploymentBucketProp}`, {})

    this.config = get(this.serverless.service, 'custom.deploymentBucket', {})

    this.hooks = {}

    if (this.config.enabled !== undefined && this.config.enabled === false) {
      return;
    }

    if (this.deploymentBucket.name) {
      this.config.versioning = get(this.config, 'versioning', false)
      this.config.accelerate = get(this.config, 'accelerate', false)
      this.config.policy = get(this.config, 'policy', undefined)
      this.config.tags = util.filterValidBucketTags(get(this.config, 'tags', undefined))
      this.config.blockPublicAccess = get(this.config, 'blockPublicAccess', undefined)

      const serverlessCommand = get(this.serverless, 'processedInput.commands', [])
      if (!serverlessCommand.includes('package')) {
        this.hooks['before:aws:common:validate:validate'] = this.applyDeploymentBucket.bind(this)
      }
    }
  }

  async bucketExists(name) {
    var params = {
      Bucket: name
    };

    try {
      await this.provider.request('S3', 'headBucket', params)
      return true
    } catch (e) {
      return false
    }
  }

  async waitFor(name, state) {
    var params = {
      Bucket: name
    };

    try {
      const service = new this.provider.sdk['S3'](this.provider.getCredentials())
      await service.waitFor(state, params).promise()

      return true
    } catch (e) {
      this.serverless.cli.log(`Unable to wait for '${state}' - ${e.message}`)

      return false
    }
  }

  async createBucket(name) {
    const params = {
      Bucket: name,
      ACL: 'private'
    };

    return await this.provider.request('S3', 'createBucket', params)
  }

  async hasBucketEncryption(name) {
    const params = {
      Bucket: name
    };

    try {
      await this.provider.request('S3', 'getBucketEncryption', params)
      return true
    } catch (e) {
      return false
    }
  }

  async putBucketEncryption(name, sseAlgorithm, kmsMasterKeyId) {
    const params = {
      Bucket: name,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: sseAlgorithm,
              KMSMasterKeyID: kmsMasterKeyId
            }
          }
        ]
      }
    }

    return await this.provider.request('S3', 'putBucketEncryption', params)
  }

  async hasBucketVersioning(name) {
    const params = {
      Bucket: name
    };

    try {
      const response = await this.provider.request('S3', 'getBucketVersioning', params)
      if (response.Status && response.Status == 'Enabled') {
        return true
      }

      return false
    } catch (e) {
      return false
    }
  }

  async putBucketVersioning(name, status) {
    const params = {
      Bucket: name,
      VersioningConfiguration: {
        Status: status ? 'Enabled' : 'Suspended'
      }
    };

    return await this.provider.request('S3', 'putBucketVersioning', params)
  }

  async hasBucketAcceleration(name) {
    const params = {
      Bucket: name
    };

    try {
      const response = await this.provider.request('S3', 'getBucketAccelerateConfiguration', params)
      if (response.Status && response.Status == 'Enabled') {
        return true
      }

      return false
    } catch (e) {
      return false
    }
  }

  async putBucketAcceleration(name, status) {
    const params = {
      Bucket: name,
      AccelerateConfiguration: {
        Status: status ? 'Enabled' : 'Suspended'
      }
    };

    return await this.provider.request('S3', 'putBucketAccelerateConfiguration', params)
  }

  async putBucketPolicy(name, policy) {
    const params = {
      Bucket: name,
      Policy: JSON.stringify(policy),
    };
    return await this.provider.request('S3', 'putBucketPolicy', params)
  }

  async hasChangedBucketTags(name, tags) {
    try {
      const response = await this.provider.request('S3', 'getBucketTagging', { Bucket: name })
      return response && JSON.stringify(response.TagSet) !== JSON.stringify(tags)
    } catch (e) {
      return false
    }
  }

  async updateBucketTags(name, tags) {
    if (Array.isArray(tags) && tags.length) {
      return await this.provider.request('S3', 'putBucketTagging', {
        Bucket: name,
        Tagging: { TagSet: tags }
      })
    } else {
      return await this.provider.request('S3', 'deleteBucketTagging', {
        Bucket: name
      })
    }
  }

  async hasChangedPublicAccessBlock(name, blockPublicAccess) {
    try {
      const config = getPublicAccessBlock(blockPublicAccess)
      const response = await this.provider.request('S3', 'getPublicAccessBlock', { Bucket: name })
      return response && JSON.stringify(response.PublicAccessBlockConfiguration) !== JSON.stringify(config)
    } catch (e) {
      return blockPublicAccess
    }
  }

  async updatePublicAccessBlock(name, blockPublicAccess) {
    if (blockPublicAccess === true) {
      return await this.provider.request('S3', 'putPublicAccessBlock', {
        Bucket: name,
        PublicAccessBlockConfiguration: getPublicAccessBlock(blockPublicAccess)
      })
    } else {
      return await this.provider.request('S3', 'deletePublicAccessBlock', {
        Bucket: name
      })
    }
  }

  async applyDeploymentBucket() {
    try {
      let isNewBucket = false

      if (await this.bucketExists(this.deploymentBucket.name)) {
        this.serverless.cli.log(`Using deployment bucket '${this.deploymentBucket.name}'`)
      } else {
        this.serverless.cli.log(`Creating deployment bucket '${this.deploymentBucket.name}'...`)

        await this.createBucket(this.deploymentBucket.name)
        await this.waitFor(this.deploymentBucket.name, 'bucketExists')
        isNewBucket = true
      }

      if (this.deploymentBucket.serverSideEncryption) {
        if (!(await this.hasBucketEncryption(this.deploymentBucket.name))) {
          if (this.deploymentBucket.serverSideEncryption === "aws:kms") {
            await this.putBucketEncryption(this.deploymentBucket.name, this.deploymentBucket.serverSideEncryption, this.deploymentBucket.kmsKeyID)
          }

          if (this.deploymentBucket.serverSideEncryption === "AES256") {
            await this.putBucketEncryption(this.deploymentBucket.name, this.deploymentBucket.serverSideEncryption)
          }

          this.serverless.cli.log(`Applied SSE (${this.deploymentBucket.serverSideEncryption}) to deployment bucket`)
        }
      }

      if ((await this.hasBucketVersioning(this.deploymentBucket.name)) != this.config.versioning) {
        await this.putBucketVersioning(this.deploymentBucket.name, this.config.versioning)

        if (this.config.versioning) {
          this.serverless.cli.log('Enabled versioning on deployment bucket')
        } else {
          this.serverless.cli.log('Suspended versioning on deployment bucket')
        }
      }

      if ((await this.hasBucketAcceleration(this.deploymentBucket.name)) != this.config.accelerate) {
        await this.putBucketAcceleration(this.deploymentBucket.name, this.config.accelerate)

        if (this.config.accelerate) {
          this.serverless.cli.log('Enabled acceleration on deployment bucket')
        } else {
          this.serverless.cli.log('Suspended acceleration on deployment bucket')
        }
      }

      if (this.config.policy) {
        await this.putBucketPolicy(this.deploymentBucket.name, this.config.policy)
        this.serverless.cli.log(`Applied deployment bucket policy`)
      }

      const hasChangedBucketTags = (isNewBucket && Array.isArray(this.config.tags) && this.config.tags.length) ||
        (await this.hasChangedBucketTags(this.deploymentBucket.name, this.config.tags));
      if (hasChangedBucketTags) {
        await this.updateBucketTags(this.deploymentBucket.name, this.config.tags)
        this.serverless.cli.log('Updated deployment bucket tags')
      }

      const hasChangedPublicAccessBlock = (isNewBucket && typeof this.config.blockPublicAccess === 'boolean') ||
        (await this.hasChangedPublicAccessBlock(this.deploymentBucket.name, this.config.blockPublicAccess));
      if (hasChangedPublicAccessBlock) {
        await this.updatePublicAccessBlock(this.deploymentBucket.name, this.config.blockPublicAccess)
        this.serverless.cli.log('Updated deployment bucket public access block')
      }
    } catch (e) {
      console.error(chalk.red(`\n-------- Deployment Bucket Error --------\n${e.message}`))
    }
  }
}

module.exports = DeploymentBucketPlugin
