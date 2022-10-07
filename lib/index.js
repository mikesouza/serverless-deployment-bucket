'use strict'

const util = require('./util')

const get = (obj, path, defaultValue) => {
  return path.split('.').filter(Boolean).every(step => !(step && !(obj = obj[step]))) ? obj : defaultValue
}

const getPublicAccessBlock = block => block === true
  ? { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true }
  : { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false }

class DeploymentBucketPlugin {
  constructor(serverless, _cliOptions, { log }) {
    this.log = log;
    this.provider = serverless.getProvider('aws');
    this.deploymentBucket = get(serverless.service, `provider.deploymentBucketObject`, {})
    this.config = get(serverless.service, 'custom.deploymentBucket', {})
    this.hooks = {}

    if (this.config.enabled !== undefined && this.config.enabled === false) {
      return;
    }

    if (this.deploymentBucket.name) {
      this.config.versioning = get(this.config, 'versioning', false)
      this.config.accessLog = get(this.config, 'accessLog', false)
      this.config.accelerate = get(this.config, 'accelerate', false)
      this.config.policy = get(this.config, 'policy', undefined)
      this.config.tags = util.filterValidBucketTags(get(this.config, 'tags', undefined))
      this.config.blockPublicAccess = get(this.config, 'blockPublicAccess', undefined)

      const serverlessCommand = get(serverless, 'processedInput.commands', [])
      if (!serverlessCommand.includes('package')) {
        this.hooks['before:aws:common:validate:validate'] = this.applyDeploymentBucket.bind(this)
      }
    }

    this.isCrossAccount = false;
  }

  async bucketExists(name) {
    // provider.accountId is null when using a cross account role.
    const currentAccountId = this.provider.accountId || (await this.provider.request('STS', 'getCallerIdentity'))?.Account;

    var params = {
      Bucket: name,
      // Throws "AWS_S3_HEAD_BUCKET_FORBIDDEN" for cross account buckets.
      ExpectedBucketOwner: currentAccountId
    };

    try {
      await this.provider.request('S3', 'headBucket', params)
      return true
    } catch (e) {
      if (e.code === 'AWS_S3_HEAD_BUCKET_FORBIDDEN') {
        this.log.info(`Cross account bucket is being used`);
        this.isCrossAccount = true;

        return true;
      }
      return false
    }
  }

  async waitFor(name, state) {
    var params = {
      Bucket: name
    };

    try {
      const service = new this.provider.sdk['S3'](this.provider.getCredentials());
      await service.waitFor(state, params).promise();

      return true;
    } catch (e) {
      this.log.error(`Unable to wait for '${state}' - ${e.message}`);

      return false;
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

  async shouldUpdateBucketAccessLogging (name, config) {
    const params = {
      Bucket: name
    }

    try {
      const response = await this.provider.request('S3', 'getBucketLogging', params)
      const loggingEnabledAndMatches = response.LoggingEnabled
        && config.bucket === response.LoggingEnabled.TargetBucket
        && config.prefix === response.LoggingEnabled.TargetPrefix

      return !(loggingEnabledAndMatches || (!response.LoggingEnabled && !config));
    } catch (e) {
      this.log.info('Failed to get bucket logging configuration', e)
      return false;
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

  async putBucketAccessLogging (name, { bucket, prefix }) {
    const params = bucket ? {
      Bucket: name,
      BucketLoggingStatus: {
        LoggingEnabled: {
          TargetBucket: bucket,
          TargetPrefix: prefix
        }
      }
    } : {
      Bucket: name,
      BucketLoggingStatus: {}
    }
    try {
      return await this.provider.request('S3', 'putBucketLogging', params)
    } catch (e) {
      this.log.warning('Failed to put bucket logging configuration', e)
      return false
    }

  }

  async hasBucketAcceleration (name) {
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
      return Boolean(tags)
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
        this.log.info(`Using deployment bucket '${this.deploymentBucket.name}'`)
      } else {
        this.log.notice(`Creating deployment bucket '${this.deploymentBucket.name}'...`)

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

          this.log.info(`Applied SSE (${this.deploymentBucket.serverSideEncryption}) to deployment bucket`)
        }
      }

      if ((await this.hasBucketVersioning(this.deploymentBucket.name)) != this.config.versioning) {
        await this.putBucketVersioning(this.deploymentBucket.name, this.config.versioning)

        if (this.config.versioning) {
          this.log.info('Enabled versioning on deployment bucket')
        } else {
          this.log.info('Suspended versioning on deployment bucket')
        }
      }

      if ((await this.hasBucketAcceleration(this.deploymentBucket.name)) != this.config.accelerate) {
        await this.putBucketAcceleration(this.deploymentBucket.name, this.config.accelerate)

        if (this.config.accelerate) {
          this.log.info('Enabled acceleration on deployment bucket')
        } else {
          this.log.info('Suspended acceleration on deployment bucket')
        }
      }

      if (this.config.policy && !this.isCrossAccount) {
        await this.putBucketPolicy(this.deploymentBucket.name, this.config.policy)
        this.log.info(`Applied deployment bucket policy`)
      } else if (this.config.policy && this.isCrossAccount) {
        this.log.notice(`Skipping bucket policy because bucket is cross account`);
      }

      const hasChangedBucketTags = (isNewBucket && Array.isArray(this.config.tags) && this.config.tags.length) ||
        (await this.hasChangedBucketTags(this.deploymentBucket.name, this.config.tags));
      if (hasChangedBucketTags) {
        await this.updateBucketTags(this.deploymentBucket.name, this.config.tags)
        this.log.info('Updated deployment bucket tags')
      }

      const hasChangedPublicAccessBlock = (isNewBucket && typeof this.config.blockPublicAccess === 'boolean') ||
        (await this.hasChangedPublicAccessBlock(this.deploymentBucket.name, this.config.blockPublicAccess));
      if (hasChangedPublicAccessBlock) {
        await this.updatePublicAccessBlock(this.deploymentBucket.name, this.config.blockPublicAccess)
        this.log.info('Updated deployment bucket public access block')
      }

      if ((await this.shouldUpdateBucketAccessLogging(this.deploymentBucket.name, this.config.accessLog))) {
        await this.putBucketAccessLogging(this.deploymentBucket.name, this.config.accessLog)

        if (this.config.accessLog) {
          this.log.info('Enabled access logging on deployment bucket')
        } else {
          this.log.info('Suspended access logging on deployment bucket')
        }
      }

    } catch (e) {
      this.log.error('\n-------- Deployment Bucket Error --------\n%s', e.message);
    }
  }
}

module.exports = DeploymentBucketPlugin
