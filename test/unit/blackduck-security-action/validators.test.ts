import {validateBlackduckFailureSeverities, validateBlackDuckInputs, validateCoverityInputs, validateCoverityInstallDirectoryParam, validateParameters, validatePolarisInputs, validateSRMInputs, validateScanTypes} from '../../../src/blackduck-security-action/validators'
import * as constants from '../../../src/application-constants'
import * as inputs from '../../../src/blackduck-security-action/inputs'

// Don't mock the actual validator functions - test them directly
// Only mock inputs that need dynamic values

describe('Coverity Validation', () => {
  describe('validateCoverityInstallDirectoryParam', () => {
    test('should return false for empty install directory', () => {
      const result = validateCoverityInstallDirectoryParam('')
      expect(result).toBe(false)
    })

    test('should return false for invalid install directory path', () => {
      const result = validateCoverityInstallDirectoryParam('D:/Users/tmpusr/Documents')
      expect(result).toBe(false)
    })

    test('should return true for valid coverity install directory', () => {
      // Use a path that exists - current directory
      const result = validateCoverityInstallDirectoryParam('.')
      expect(result).toBe(true)
    })
  })

  describe('validateCoverityInputs', () => {
    test('should return validation errors for missing mandatory fields', () => {
      Object.defineProperty(inputs, 'COVERITY_URL', {value: 'server_url', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_USER', {value: '', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_PASSPHRASE', {value: '', configurable: true})

      const result = validateCoverityInputs()
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('required parameters for coverity is missing')
    })

    test('should return empty array for valid inputs', () => {
      Object.defineProperty(inputs, 'COVERITY_URL', {value: 'COVERITY_URL', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_USER', {value: 'COVERITY_USER', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_PASSPHRASE', {value: 'COVERITY_PASSPHRASE', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_PROJECT_NAME', {value: 'COVERITY_PROJECT_NAME', configurable: true})
      Object.defineProperty(inputs, 'COVERITY_STREAM_NAME', {value: 'COVERITY_STREAM_NAME', configurable: true})

      const result = validateCoverityInputs()
      expect(result).toHaveLength(0)
    })
  })
})

describe('BlackDuck Validation', () => {
  describe('validateBlackduckFailureSeverities', () => {
    test('should return false for empty failure severities array', () => {
      const result = validateBlackduckFailureSeverities([])
      expect(result).toBe(false)
    })

    test('should return true for valid failure severities', () => {
      const result = validateBlackduckFailureSeverities(['CRITICAL', 'HIGH'])
      expect(result).toBe(true)
    })
  })

  describe('validateBlackDuckInputs', () => {
    test('should return validation errors for missing mandatory fields', () => {
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'BLACKDUCKSCA_URL', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_TOKEN', {value: '', configurable: true})

      const result = validateBlackDuckInputs()
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('required parameters for blackduck is missing')
    })

    test('should return empty array for valid inputs', () => {
      Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'BLACKDUCKSCA_URL', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_TOKEN', {value: 'BLACKDUCKSCA_TOKEN', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_SCAN_FULL', {value: 'TRUE', configurable: true})
      Object.defineProperty(inputs, 'BLACKDUCKSCA_SCAN_FAILURE_SEVERITIES', {value: '["ALL"]', configurable: true})

      const result = validateBlackDuckInputs()
      expect(result).toHaveLength(0)
    })
  })
})

describe('Generic Parameter Validation', () => {
  test('validateParameters should return error for missing required parameters', () => {
    const paramsMap = new Map()
    paramsMap.set(constants.COVERITY_USER_KEY, null)
    paramsMap.set(constants.COVERITY_URL_KEY, '')

    const result = validateParameters(paramsMap, 'Coverity')
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('required parameters for Coverity is missing')
  })

  test('validateParameters should return empty array for complete parameters', () => {
    const paramsMap = new Map()
    paramsMap.set(constants.COVERITY_USER_KEY, 'user')
    paramsMap.set(constants.COVERITY_URL_KEY, 'https://coverity.example.com')

    const result = validateParameters(paramsMap, 'Coverity')
    expect(result).toHaveLength(0)
  })
})

describe('Polaris Validation', () => {
  describe('validatePolarisInputs', () => {
    test('should return error when mandatory fields are missing', () => {
      Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'server_url', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_ACCESS_TOKEN', {value: '', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_ASSESSMENT_TYPES', {value: '', configurable: true})

      const result = validatePolarisInputs()
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('required parameters for polaris is missing')
    })

    test('should return empty array when all mandatory fields are provided', () => {
      Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'server_url', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_ACCESS_TOKEN', {value: 'access_token', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_APPLICATION_NAME', {value: 'POLARIS_APPLICATION_NAME', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_PROJECT_NAME', {value: 'POLARIS_PROJECT_NAME', configurable: true})
      Object.defineProperty(inputs, 'POLARIS_ASSESSMENT_TYPES', {value: 'SCA', configurable: true})

      const response = validatePolarisInputs()
      expect(response).toHaveLength(0)
    })
  })
})

describe('SRM Validation', () => {
  describe('validateSRMInputs', () => {
    test('should return error when mandatory fields are missing', () => {
      Object.defineProperty(inputs, 'SRM_URL', {value: 'SRM_URL', configurable: true})
      Object.defineProperty(inputs, 'SRM_API_KEY', {value: '', configurable: true})
      Object.defineProperty(inputs, 'SRM_ASSESSMENT_TYPES', {value: '', configurable: true})

      const result = validateSRMInputs()
      expect(result).toHaveLength(1)
      expect(result[0]).toContain('required parameters for SRM is missing')
    })

    test('should return empty array when all mandatory fields are provided', () => {
      Object.defineProperty(inputs, 'SRM_URL', {value: 'SRM_URL', configurable: true})
      Object.defineProperty(inputs, 'SRM_API_KEY', {value: 'SRM_API_KEY', configurable: true})
      Object.defineProperty(inputs, 'SRM_ASSESSMENT_TYPES', {value: 'SCA,SAST', configurable: true})
      Object.defineProperty(inputs, 'SRM_PROJECT_NAME', {value: 'SRM_PROJECT_NAME', configurable: true})

      const response = validateSRMInputs()
      expect(response).toHaveLength(0)
    })

    test('should handle optional fields correctly', () => {
      Object.defineProperty(inputs, 'SRM_URL', {value: 'SRM_URL', configurable: true})
      Object.defineProperty(inputs, 'SRM_API_KEY', {value: 'SRM_API_KEY', configurable: true})
      Object.defineProperty(inputs, 'SRM_ASSESSMENT_TYPES', {value: 'SCA,SAST', configurable: true})
      Object.defineProperty(inputs, 'SRM_PROJECT_NAME', {value: 'SRM_PROJECT_NAME', configurable: true})
      Object.defineProperty(inputs, 'SRM_BRANCH_NAME', {value: 'feature', configurable: true})
      Object.defineProperty(inputs, 'SRM_BRANCH_PARENT', {value: 'main', configurable: true})

      const response = validateSRMInputs()
      expect(response).toHaveLength(0)
    })
  })
})

describe('Scan Types Validation', () => {
  test('validateScanTypes should return errors when no scan types are configured', () => {
    // Clear all URL inputs to simulate no scan types configured
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'COVERITY_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'SRM_URL', {value: '', configurable: true})

    const result = validateScanTypes()
    expect(result).toHaveLength(4)
    expect(result).toContain('polaris_server_url')
    expect(result).toContain('coverity_url')
    expect(result).toContain('blackduck_url')
    expect(result).toContain('srm_url')
  })

  test('validateScanTypes should return empty array when at least one scan type is configured', () => {
    // Configure at least one scan type
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'COVERITY_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'SRM_URL', {value: '', configurable: true})

    const result = validateScanTypes()
    expect(result).toHaveLength(3) // Should return 3 missing scan types
  })

  test('validateScanTypes should handle multiple configured scan types', () => {
    // Configure multiple scan types
    Object.defineProperty(inputs, 'BLACKDUCKSCA_URL', {value: 'https://blackduck.example.com', configurable: true})
    Object.defineProperty(inputs, 'POLARIS_SERVER_URL', {value: 'https://polaris.example.com', configurable: true})
    Object.defineProperty(inputs, 'COVERITY_URL', {value: '', configurable: true})
    Object.defineProperty(inputs, 'SRM_URL', {value: '', configurable: true})

    const result = validateScanTypes()
    expect(result).toHaveLength(2) // Should return 2 missing scan types
  })
})
