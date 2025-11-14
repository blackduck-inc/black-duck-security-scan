import {BridgeClientBase} from '../../../../src/blackduck-security-action/bridge/bridge-client-base'
import {ExecOptions} from '@actions/exec'
import {DownloadFileResponse} from '../../../../src/blackduck-security-action/download-utility'
import * as core from '@actions/core'
import * as utility from '../../../../src/blackduck-security-action/utility'
import DomParser from 'dom-parser'

// Mock all external dependencies
jest.mock('@actions/core')
jest.mock('../../../../src/blackduck-security-action/utility')
jest.mock('dom-parser')

// Mock constants
jest.mock('../../../../src/application-constants', () => ({
  RETRY_COUNT: 3,
  RETRY_DELAY_IN_MILLISECONDS: 15000,
  NON_RETRY_HTTP_CODES: new Set([200, 201, 401, 403, 416])
}))

// Create a concrete test implementation of the abstract class
class TestBridgeClient extends BridgeClientBase {
  constructor() {
    super()
    this.bridgeArtifactoryURL = 'https://test-artifactory.com/bridge/versions'
  }

  getBridgeFileType(): string {
    return 'bridge-cli'
  }

  getBridgeFileNameType(): string {
    return 'bridge-cli'
  }

  async getBridgeVersion(): Promise<string> {
    return '1.0.0'
  }

  getBridgeType(): string {
    return 'bridge-cli-bundle'
  }

  generateFormattedCommand(stage: string, stateFilePath: string, workflowVersion?: string): string {
    return `--stage ${stage} --state ${stateFilePath}`
  }

  async isBridgeInstalled(bridgeVersion: string): Promise<boolean> {
    return false
  }

  async validateAndSetBridgePath(): Promise<void> {
    this.bridgePath = '/test/bridge/path'
  }

  protected async checkIfBridgeExistsInAirGap(): Promise<boolean> {
    return false
  }

  protected async executeCommand(bridgeCommand: string, execOptions: ExecOptions): Promise<number> {
    return 0
  }

  protected getLatestVersionRegexPattern(): RegExp {
    return /latest/g
  }

  protected getBridgeCLIDownloadDefaultPath(): string {
    return '/default/bridge/path'
  }

  protected async handleBridgeDownload(downloadResponse: DownloadFileResponse, extractZippedFilePath: string): Promise<void> {
    // Mock implementation
  }

  protected initializeUrls(): void {
    this.bridgeArtifactoryURL = 'https://test-artifactory.com/bridge/versions'
  }

  protected async processBaseUrlWithLatest(): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: '1.0.0'}
  }

  protected async processLatestVersion(isAirGap: boolean): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: '1.0.0'}
  }

  protected async updateBridgeCLIVersion(requestedVersion: string): Promise<{bridgeUrl: string; bridgeVersion: string}> {
    return {bridgeUrl: 'test-url', bridgeVersion: requestedVersion}
  }

  protected verifyRegexCheck(bridgeUrl: string): RegExpMatchArray | null {
    return null
  }
}

describe('getAllAvailableBridgeVersions', () => {
  let testBridgeClient: TestBridgeClient
  let mockHttpClient: any
  let mockHttpResponse: any
  let mockDomParser: any
  let mockDoms: any
  let mockElements: any[]

  beforeEach(() => {
    testBridgeClient = new TestBridgeClient()

    // Reset all mocks
    jest.clearAllMocks()

    // Mock HTTP response structure
    mockHttpResponse = {
      message: {
        statusCode: 200
      },
      readBody: jest.fn()
    }

    // Mock HTTP client
    mockHttpClient = {
      get: jest.fn().mockResolvedValue(mockHttpResponse)
    }

    // Mock getSharedHttpClient
    ;(utility.getSharedHttpClient as jest.Mock).mockReturnValue(mockHttpClient)

    // Mock DOM parser and elements
    mockElements = []
    mockDoms = {
      getElementsByTagName: jest.fn().mockReturnValue(mockElements)
    }
    mockDomParser = {
      parseFromString: jest.fn().mockReturnValue(mockDoms)
    }
    ;(DomParser as any).mockImplementation(() => mockDomParser)

    // Mock sleep function
    ;(utility.sleep as jest.Mock).mockResolvedValue(undefined)
  })

  describe('successful version retrieval', () => {
    it('should handle empty valid versions in HTML response', async () => {
      const htmlContent = '<html><body><a href="/invalid/">invalid</a></body></html>'

      mockHttpResponse.readBody.mockResolvedValue(htmlContent)
      mockElements = [{textContent: 'invalid-version'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual([])
      expect(core.warning).toHaveBeenCalledWith('Unable to retrieve the Bridge Versions from Artifactory')
    })

    it('should handle null elements from DOM parser', async () => {
      const htmlContent = '<html><body></body></html>'

      mockHttpResponse.readBody.mockResolvedValue(htmlContent)
      mockDoms.getElementsByTagName.mockReturnValue(null)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual([])
      expect(core.warning).toHaveBeenCalledWith('Unable to retrieve the Bridge Versions from Artifactory')
    })

    it('should handle elements with null textContent', async () => {
      const htmlContent = '<html><body><a href="/test/"></a></body></html>'

      mockHttpResponse.readBody.mockResolvedValue(htmlContent)
      mockElements = [{textContent: null}, {textContent: '1.0.0'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['1.0.0'])
    })
  })

  describe('retry logic', () => {
    it('should retry on non-success HTTP status codes', async () => {
      // First two calls return 500, third call returns 200
      mockHttpClient.get
        .mockResolvedValueOnce({message: {statusCode: 500}})
        .mockResolvedValueOnce({message: {statusCode: 502}})
        .mockResolvedValueOnce(mockHttpResponse)

      mockHttpResponse.readBody.mockResolvedValue('<html><body><a>1.0.0</a></body></html>')
      mockElements = [{textContent: '1.0.0'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['1.0.0'])
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3)
      expect(utility.sleep).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retry HTTP status codes', async () => {
      mockHttpResponse.message.statusCode = 401
      mockHttpResponse.readBody.mockResolvedValue('<html><body><a>1.0.0</a></body></html>')
      mockElements = [{textContent: '1.0.0'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['1.0.0'])
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1)
      expect(utility.sleep).not.toHaveBeenCalled()
    })

    it('should exhaust all retries and show warning when no versions found', async () => {
      mockHttpClient.get.mockResolvedValue({message: {statusCode: 500}})

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual([])
      expect(mockHttpClient.get).toHaveBeenCalledTimes(3) // Initial + 2 retries
      expect(utility.sleep).toHaveBeenCalledTimes(3)
      expect(core.warning).toHaveBeenCalledWith('Unable to retrieve the Bridge Versions from Artifactory')
    })

    it('should implement exponential backoff for retry delays', async () => {
      mockHttpClient.get.mockResolvedValue({message: {statusCode: 500}})

      await testBridgeClient.getAllAvailableBridgeVersions()

      // Verify exponential backoff: 15000, 30000, 60000
      expect(utility.sleep).toHaveBeenNthCalledWith(1, 15000)
      expect(utility.sleep).toHaveBeenNthCalledWith(2, 30000)
      expect(utility.sleep).toHaveBeenNthCalledWith(3, 60000)
    })
  })

  describe('version parsing', () => {
    beforeEach(() => {
      mockHttpResponse.readBody.mockResolvedValue('<html><body></body></html>')
    })

    it('should extract versions matching semantic version pattern', async () => {
      mockElements = [{textContent: '1.0.0'}, {textContent: '2.10.15'}, {textContent: '10.5.3'}, {textContent: '1.0'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['1.0.0', '2.10.15', '10.5.3'])
    })

    it('should handle duplicate versions', async () => {
      mockElements = [
        {textContent: '1.0.0'},
        {textContent: '2.0.0'},
        {textContent: '1.0.0'}, // Duplicate
        {textContent: '2.0.0'} // Duplicate
      ]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['1.0.0', '2.0.0', '1.0.0', '2.0.0']) // Method doesn't deduplicate
    })

    it('should handle edge case version numbers', async () => {
      mockElements = [{textContent: '0.0.0'}, {textContent: '999.999.999'}, {textContent: '1.0.0'}]
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toEqual(['0.0.0', '999.999.999', '1.0.0'])
    })
  })

  describe('integration scenarios', () => {
    it('should handle large number of versions efficiently', async () => {
      const versions = Array.from({length: 100}, (_, i) => `${Math.floor(i / 10)}.${i % 10}.0`)
      mockElements = versions.map(v => ({textContent: v}))
      mockDoms.getElementsByTagName.mockReturnValue(mockElements)
      mockHttpResponse.readBody.mockResolvedValue('<html><body></body></html>')

      const result = await testBridgeClient.getAllAvailableBridgeVersions()

      expect(result).toHaveLength(100)
      expect(result).toContain('0.0.0')
      expect(result).toContain('9.9.0')
    })
  })
})
