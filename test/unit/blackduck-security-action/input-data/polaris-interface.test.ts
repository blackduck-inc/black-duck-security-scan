import {Polaris, CoverityArbitrary, PolarisData} from '../../../../src/blackduck-security-action/input-data/polaris'
import {Command, Config} from '../../../../src/blackduck-security-action/input-data/coverity'

describe('Polaris Interface - SIGINT-3342 Tests', () => {
  describe('CoverityArbitrary Interface', () => {
    test('should allow creating coverity object with only version field', () => {
      const coverity: CoverityArbitrary = {
        version: '2024.6.0'
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.build).toBeUndefined()
      expect(coverity.clean).toBeUndefined()
      expect(coverity.config).toBeUndefined()
      expect(coverity.args).toBeUndefined()
    })

    test('should allow creating coverity object with version and build command', () => {
      const buildCommand: Command = {command: 'mvn clean install'}
      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        build: buildCommand
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.build?.command).toBe('mvn clean install')
      expect(coverity.clean).toBeUndefined()
      expect(coverity.config).toBeUndefined()
      expect(coverity.args).toBeUndefined()
    })

    test('should allow creating coverity object with all fields', () => {
      const buildCommand: Command = {command: 'mvn clean install'}
      const cleanCommand: Command = {command: 'mvn clean'}
      const config: Config = {path: '/path/to/config.yml'}

      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        build: buildCommand,
        clean: cleanCommand,
        config: config,
        args: '--some-args'
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.build?.command).toBe('mvn clean install')
      expect(coverity.clean?.command).toBe('mvn clean')
      expect(coverity.config?.path).toBe('/path/to/config.yml')
      expect(coverity.args).toBe('--some-args')
    })

    test('should allow creating coverity object without version field (backward compatibility)', () => {
      const buildCommand: Command = {command: 'gradle build'}
      const coverity: CoverityArbitrary = {
        build: buildCommand
      }

      expect(coverity.version).toBeUndefined()
      expect(coverity.build?.command).toBe('gradle build')
    })

    test('should allow empty coverity object', () => {
      const coverity: CoverityArbitrary = {}

      expect(coverity.version).toBeUndefined()
      expect(coverity.build).toBeUndefined()
      expect(coverity.clean).toBeUndefined()
      expect(coverity.config).toBeUndefined()
      expect(coverity.args).toBeUndefined()
    })

    test('should allow different version format strings', () => {
      const versions = ['2024.6.0', '2023.12', '2024.6.0-beta', 'latest', '1.0']

      versions.forEach(versionString => {
        const coverity: CoverityArbitrary = {
          version: versionString
        }
        expect(coverity.version).toBe(versionString)
      })
    })

    test('should allow version with build and clean but no config', () => {
      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        build: {command: 'npm run build'},
        clean: {command: 'npm run clean'}
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.build?.command).toBe('npm run build')
      expect(coverity.clean?.command).toBe('npm run clean')
      expect(coverity.config).toBeUndefined()
      expect(coverity.args).toBeUndefined()
    })

    test('should allow version with config but no build/clean', () => {
      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        config: {path: '/custom/coverity.yml'}
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.config?.path).toBe('/custom/coverity.yml')
      expect(coverity.build).toBeUndefined()
      expect(coverity.clean).toBeUndefined()
    })

    test('should allow version with args only', () => {
      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        args: '--enable-all-checkers'
      }

      expect(coverity.version).toBe('2024.6.0')
      expect(coverity.args).toBe('--enable-all-checkers')
      expect(coverity.build).toBeUndefined()
      expect(coverity.clean).toBeUndefined()
      expect(coverity.config).toBeUndefined()
    })
  })

  describe('Polaris Interface with CoverityArbitrary', () => {
    test('should allow Polaris object with coverity version field', () => {
      const polarisData: PolarisData = {
        accesstoken: 'test-token',
        serverUrl: 'https://polaris.example.com',
        application: {name: 'test-app'},
        project: {name: 'test-project'},
        assessment: {types: ['SAST']}
      }

      const polaris: Polaris = {
        polaris: polarisData,
        coverity: {
          version: '2024.6.0'
        },
        network: {},
        bridge: {
          invoked: {
            from: 'github-cloud'
          }
        }
      }

      expect(polaris.coverity?.version).toBe('2024.6.0')
      expect(polaris.polaris.application.name).toBe('test-app')
    })

    test('should allow Polaris object with coverity containing all fields', () => {
      const polarisData: PolarisData = {
        accesstoken: 'test-token',
        serverUrl: 'https://polaris.example.com',
        application: {name: 'test-app'},
        project: {name: 'test-project'},
        assessment: {types: ['SAST', 'SCA']}
      }

      const polaris: Polaris = {
        polaris: polarisData,
        coverity: {
          version: '2024.6.0',
          build: {command: 'make'},
          clean: {command: 'make clean'},
          config: {path: '/opt/coverity/config.yml'},
          args: '--security-profile high'
        },
        network: {},
        bridge: {
          invoked: {
            from: 'github-cloud'
          }
        }
      }

      expect(polaris.coverity?.version).toBe('2024.6.0')
      expect(polaris.coverity?.build?.command).toBe('make')
      expect(polaris.coverity?.clean?.command).toBe('make clean')
      expect(polaris.coverity?.config?.path).toBe('/opt/coverity/config.yml')
      expect(polaris.coverity?.args).toBe('--security-profile high')
    })

    test('should allow Polaris object without coverity field', () => {
      const polarisData: PolarisData = {
        accesstoken: 'test-token',
        serverUrl: 'https://polaris.example.com',
        application: {name: 'test-app'},
        project: {name: 'test-project'},
        assessment: {types: ['SCA']}
      }

      const polaris: Polaris = {
        polaris: polarisData,
        network: {},
        bridge: {
          invoked: {
            from: 'github-cloud'
          }
        }
      }

      expect(polaris.coverity).toBeUndefined()
      expect(polaris.polaris.assessment.types).toEqual(['SCA'])
    })

    test('should allow Polaris object with empty coverity object', () => {
      const polarisData: PolarisData = {
        accesstoken: 'test-token',
        serverUrl: 'https://polaris.example.com',
        application: {name: 'test-app'},
        project: {name: 'test-project'},
        assessment: {types: ['SAST']}
      }

      const polaris: Polaris = {
        polaris: polarisData,
        coverity: {},
        network: {},
        bridge: {
          invoked: {
            from: 'github-cloud'
          }
        }
      }

      expect(polaris.coverity).toBeDefined()
      expect(polaris.coverity?.version).toBeUndefined()
      expect(polaris.coverity?.build).toBeUndefined()
    })

    test('should allow Polaris object with coverity build commands but no version', () => {
      const polarisData: PolarisData = {
        accesstoken: 'test-token',
        serverUrl: 'https://polaris.example.com',
        application: {name: 'test-app'},
        project: {name: 'test-project'},
        assessment: {types: ['SAST']}
      }

      const polaris: Polaris = {
        polaris: polarisData,
        coverity: {
          build: {command: 'cargo build'},
          clean: {command: 'cargo clean'}
        },
        network: {},
        bridge: {
          invoked: {
            from: 'github-enterprise'
          }
        }
      }

      expect(polaris.coverity?.version).toBeUndefined()
      expect(polaris.coverity?.build?.command).toBe('cargo build')
      expect(polaris.coverity?.clean?.command).toBe('cargo clean')
    })
  })

  describe('Type Compatibility Tests', () => {
    test('should maintain backward compatibility - coverity can be undefined', () => {
      const polarisData: PolarisData = {
        accesstoken: 'token',
        serverUrl: 'https://polaris.test.com',
        application: {name: 'app'},
        project: {name: 'proj'},
        assessment: {types: ['SAST']}
      }

      // This should compile without errors
      const polaris1: Polaris = {
        polaris: polarisData,
        network: {},
        bridge: {invoked: {from: 'github-cloud'}}
      }

      const polaris2: Polaris = {
        polaris: polarisData,
        coverity: undefined,
        network: {},
        bridge: {invoked: {from: 'github-cloud'}}
      }

      expect(polaris1.coverity).toBeUndefined()
      expect(polaris2.coverity).toBeUndefined()
    })

    test('should allow partial CoverityArbitrary objects', () => {
      // Only version
      const coverity1: CoverityArbitrary = {version: '2024.6.0'}

      // Only build
      const coverity2: CoverityArbitrary = {build: {command: 'build.sh'}}

      // Only config
      const coverity3: CoverityArbitrary = {config: {path: '/config.yml'}}

      // Version + build
      const coverity4: CoverityArbitrary = {
        version: '2024.6.0',
        build: {command: 'build.sh'}
      }

      expect(coverity1.version).toBeDefined()
      expect(coverity2.build).toBeDefined()
      expect(coverity3.config).toBeDefined()
      expect(coverity4.version).toBeDefined()
      expect(coverity4.build).toBeDefined()
    })

    test('should allow spreading CoverityArbitrary objects', () => {
      const baseConfig: CoverityArbitrary = {
        build: {command: 'npm run build'}
      }

      const withVersion: CoverityArbitrary = {
        ...baseConfig,
        version: '2024.6.0'
      }

      expect(withVersion.build?.command).toBe('npm run build')
      expect(withVersion.version).toBe('2024.6.0')
    })

    test('should allow merging multiple CoverityArbitrary objects', () => {
      const buildConfig: CoverityArbitrary = {
        build: {command: 'make'},
        clean: {command: 'make clean'}
      }

      const versionConfig: CoverityArbitrary = {
        version: '2024.6.0'
      }

      const argsConfig: CoverityArbitrary = {
        args: '--enable-constraint-fpp --enable-fnptr --enable-virtual'
      }

      const merged: CoverityArbitrary = {
        ...buildConfig,
        ...versionConfig,
        ...argsConfig
      }

      expect(merged.build?.command).toBe('make')
      expect(merged.clean?.command).toBe('make clean')
      expect(merged.version).toBe('2024.6.0')
      expect(merged.args).toBe('--enable-constraint-fpp --enable-fnptr --enable-virtual')
    })
  })

  describe('Edge Cases', () => {
    test('should handle version overwrite when spreading objects', () => {
      const original: CoverityArbitrary = {
        version: '2023.12.0',
        build: {command: 'build'}
      }

      const updated: CoverityArbitrary = {
        ...original,
        version: '2024.6.0'
      }

      expect(updated.version).toBe('2024.6.0')
      expect(updated.build?.command).toBe('build')
    })

    test('should handle null vs undefined for optional fields', () => {
      const coverity1: CoverityArbitrary = {
        version: undefined
      }

      const coverity2: CoverityArbitrary = {}

      // Both should be valid, version is optional
      expect(coverity1.version).toBeUndefined()
      expect(coverity2.version).toBeUndefined()
    })

    test('should allow complex command structures', () => {
      const coverity: CoverityArbitrary = {
        version: '2024.6.0',
        build: {command: 'docker run --rm -v $(pwd):/app builder:latest make'},
        clean: {command: 'docker run --rm -v $(pwd):/app builder:latest make clean'},
        args: '--all --verbose --security-critical-only'
      }

      expect(coverity.build?.command).toContain('docker run')
      expect(coverity.clean?.command).toContain('make clean')
      expect(coverity.args).toContain('--all')
    })

    test('should handle version field position in object creation', () => {
      // Version first
      const coverity1: CoverityArbitrary = {
        version: '2024.6.0',
        build: {command: 'build'}
      }

      // Version last
      const coverity2: CoverityArbitrary = {
        build: {command: 'build'},
        version: '2024.6.0'
      }

      // Version in middle
      const coverity3: CoverityArbitrary = {
        build: {command: 'build'},
        version: '2024.6.0',
        clean: {command: 'clean'}
      }

      // All should work the same
      expect(coverity1.version).toBe('2024.6.0')
      expect(coverity2.version).toBe('2024.6.0')
      expect(coverity3.version).toBe('2024.6.0')
    })
  })
})
