const util = require('./util')

describe('util', () => {
  describe('deploymentBucketProperty()', () => {
    it('should return "deploymentBucket" if version > 2.9.0', () => {
      expect(util.deploymentBucketProperty('2.10.0')).toEqual('deploymentBucket')
      expect(util.deploymentBucketProperty('3.0.0')).toEqual('deploymentBucket')
    })

    it('should return "deploymentBucketObject" if version <= 2.9.0', () => {
      expect(util.deploymentBucketProperty('1.68.0')).toEqual('deploymentBucketObject')
      expect(util.deploymentBucketProperty('2.9.0')).toEqual('deploymentBucketObject')
    })
  })
})
