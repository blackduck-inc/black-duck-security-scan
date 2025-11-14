import * as core from '@actions/core'
import {RetryHelper} from '../../../src/blackduck-security-action/retry-helper'
import * as constants from '../../../src/application-constants'
import * as util from '../../../src/blackduck-security-action/utility'

jest.mock('@actions/core')
jest.mock('../../../src/blackduck-security-action/utility', () => ({
  sleep: jest.fn(() => Promise.resolve()) // 🧠 instant sleep
}))

describe('RetryHelper (fast, no real waiting)', () => {
  let retryHelper: RetryHelper
  let infoMock: jest.Mock

  beforeAll(() => {
    infoMock = jest.fn()
    ;(core.info as jest.Mock) = infoMock

    Object.defineProperty(constants, 'BRIDGE_DOWNLOAD_RETRY_ERROR', {value: 'Retry error'})
    Object.defineProperty(constants, 'RETRY_COUNT', {value: 3})
    Object.defineProperty(constants, 'RETRY_DELAY_IN_MILLISECONDS', {value: 10})
  })

  beforeEach(() => {
    jest.clearAllMocks()
    retryHelper = new RetryHelper(3, 10)
  })

  it('should return result on first success', async () => {
    const result = await retryHelper.execute(async () => 'ok')
    expect(result).toBe('ok')
    expect(infoMock).not.toHaveBeenCalled()
  })

  it('should retry once then succeed', async () => {
    let calls = 0
    const result = await retryHelper.execute(async () => {
      if (++calls === 1) throw new Error('first fail')
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
    expect(infoMock).toHaveBeenCalledWith('first fail')
  })

  it('should retry twice then succeed', async () => {
    let calls = 0
    const result = await retryHelper.execute(async () => {
      if (++calls < 3) throw new Error(`fail ${calls}`)
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(infoMock).toHaveBeenCalledTimes(4) // 2 errors + 2 retry logs
  })

  it('should fail after all retries', async () => {
    let calls = 0
    await expect(
      retryHelper.execute(async () => {
        throw new Error(`fail ${++calls}`)
      })
    ).rejects.toThrow('fail 4')
    expect(calls).toBe(4)
    expect(util.sleep).toHaveBeenCalledTimes(3)
  })

  it('should stop retrying when isRetryable() returns false', async () => {
    let calls = 0
    await expect(
      retryHelper.execute(
        async () => {
          throw new Error(`fail ${++calls}`)
        },
        () => false
      )
    ).rejects.toThrow('fail 1')
    expect(calls).toBe(1)
    expect(util.sleep).not.toHaveBeenCalled()
  })

  it('should retry once then stop when retryable() becomes false', async () => {
    let calls = 0
    await expect(
      retryHelper.execute(
        async () => {
          throw new Error(`fail ${++calls}`)
        },
        e => e.message === 'fail 1'
      )
    ).rejects.toThrow('fail 2')
    expect(calls).toBe(2)
    expect(util.sleep).toHaveBeenCalledTimes(1)
  })
})
