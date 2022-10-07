const util = require('./util')

describe('util', () => {
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
