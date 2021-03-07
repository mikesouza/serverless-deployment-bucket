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

  describe('filterValidBucketTags()', () => {
    it('should return a list of valid bucket tags', () => {
      const input = [
        { Key: 'Environment', Value: 'testing' }
      ]
      const expected = [
        { Key: 'Environment', Value: 'testing' }
      ]
      expect(util.filterValidBucketTags(input)).toEqual(expected)
    })

    it('should return a list of valid bucket tags, ignoring invalid items', () => {
      const input = [
        { Key: 'Environment', Value: 'testing' },
        { Key: 'Environment', value: 'bad-value' }
      ]
      const expected = [
        { Key: 'Environment', Value: 'testing' }
      ]
      expect(util.filterValidBucketTags(input)).toEqual(expected)
    })

    it('should return undefined if an invalid value is passed', () => {
      expect(util.filterValidBucketTags('hello-world')).toEqual(undefined)
      expect(util.filterValidBucketTags({})).toEqual(undefined)
    })
  })
})
