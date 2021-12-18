import type { FoundBrowser } from '@packages/types/src'

describe('Choose a Browser Page', () => {
  // Walks through setup pages to get to browser selection
  const stepThroughConfigPages = () => {
    cy.get('h1').should('contain', 'Configuration Files')
    cy.contains('button', 'Continue').click()
    cy.get('h1').should('contain', 'Initializing Config...')
    cy.contains('button', 'Next Step').click()
  }

  // Mocks server's browser detection with known list
  const setupMockBrowsers = function () {
    cy.withCtx(async (ctx, o) => {
      const mockBrowsers: FoundBrowser[] = [{
        channel: 'stable',
        displayName: 'Chrome',
        family: 'chromium',
        name: 'chrome',
        version: '1.2.333.445',
        path: '/test/chrome/path',
        majorVersion: '1',
      }, {
        channel: 'stable',
        displayName: 'Firefox',
        family: 'firefox',
        name: 'firefox',
        path: '/test/firefox/path',
        version: '2.3.444',
        majorVersion: '2',
      }, {
        channel: 'stable',
        displayName: 'Electron',
        family: 'chromium',
        name: 'electron',
        path: '/test/electron/path',
        version: '3.4.555.66',
        majorVersion: '3',
      }, {
        channel: 'stable',
        displayName: 'Edge',
        family: 'chromium',
        name: 'edge',
        path: '/test/edge/path',
        version: '4.5.666.77',
        majorVersion: '4',
      }]

      // @ts-ignore sinon is a global in the node process where this is executed
      sinon.stub(ctx._apis.appApi, 'getBrowsers').resolves(mockBrowsers)
    })
  }

  // Force the server to return no detected browsers
  const setupZeroMockBrowsers = function () {
    cy.withCtx(async (ctx, o) => {
      // @ts-ignore sinon is a global in the node process where this is executed
      sinon.stub(ctx._apis.appApi, 'getBrowsers').resolves([])
    })
  }

  beforeEach(() => {
    cy.scaffoldProject('launchpad')
  })

  describe('System Browsers Detected', () => {
    beforeEach(() => {
      setupMockBrowsers()
    })

    it('preselects browser that is provided through the command line', () => {
      cy.openProject('launchpad', ['--e2e', '--browser', 'edge'])

      cy.visitLaunchpad()
      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.findByRole('radio', { name: 'Edge v4.x', checked: true })
    })

    it('shows warning when launched with --browser name that cannot be matched to found browsers', () => {
      cy.openProject('launchpad', ['--e2e', '--browser', 'doesNotExist'])
      cy.visitLaunchpad()

      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')
      cy.get('[data-cy="alert-header"]').should('contain', 'Warning: Browser Not Found')
      cy.get('[data-cy="alert-body"]')
      .should('contain', 'The specified browser was not found on your system or is not supported by Cypress: doesNotExist')

      cy.get('[data-cy="alert-body"] a').eq(1)
      .should('have.attr', 'href')
      .and('equal', 'https://on.cypress.io/troubleshooting-launching-browsers')

      // Ensure warning can be dismissed
      cy.get('[data-cy="alert-suffix-icon"]').click()
      cy.get('[data-cy="alert-header"]').should('not.exist')
    })

    it('shows warning when launched with --browser path option that cannot be matched to found browsers', () => {
      cy.openProject('launchpad', ['--e2e', '--browser', '/path/does/not/exist'])

      cy.visitLaunchpad()

      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.get('[data-cy="alert-header"]').should('contain', 'Warning: Browser Not Found')
      cy.get('[data-cy="alert-body"]')
      .should('contain', 'We could not identify a known browser at the path you specified: /path/does/not/exist')
      .should('contain', 'spawn /path/does/not/exist ENOENT')

      cy.get('[data-cy="alert-body"] a')
      .should('have.attr', 'href')
      .and('equal', 'https://on.cypress.io/troubleshooting-launching-browsers')

      // Ensure warning can be dismissed
      cy.get('[data-cy="alert-suffix-icon"]').click()
      cy.get('[data-cy="alert-header"]').should('not.exist')
    })

    it('shows installed browsers with their relevant properties', () => {
      cy.openProject('launchpad', ['--e2e'])

      cy.visitLaunchpad()

      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.findByRole('radio', { name: 'Chrome v1.x' })

      cy.findByRole('radio', { name: 'Firefox v2.x' })

      cy.findByRole('radio', { name: 'Electron v3.x' })

      cy.findByRole('radio', { name: 'Edge v4.x' })
    })

    it('performs mutation to launch selected browser when launch button is pressed', () => {
      cy.openProject('launchpad', ['--e2e'])

      cy.visitLaunchpad()

      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.contains('button', 'Launch Chrome').as('launchButton')

      // Stub out response to prevent browser launch but not break internals
      cy.intercept('mutation-OpenBrowser_LaunchProject', {
        body: {
          data: {
            launchOpenProject: true,
            setProjectPreferences: {
              currentProject: {
                id: 'test-id',
                title: 'launchpad',
                __typename: 'CurrentProject',
              },
              __typename: 'Query',
            },
          },
        },
      }).as('launchProject')

      cy.get('@launchButton').click()

      cy.wait('@launchProject').then(({ request }) => {
        expect(request?.body.variables.browserPath).to.contain('/test/chrome/path')
        expect(request?.body.variables.testingType).to.eq('e2e')
      })
    })

    it('performs mutation to change selected browser when browser item is clicked', () => {
      cy.openProject('launchpad', ['--e2e'])

      cy.visitLaunchpad()
      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.findByRole('radio', { name: 'Chrome v1.x', checked: true }).as('chromeItem')
      cy.findByRole('radio', { name: 'Firefox v2.x', checked: false }).as('firefoxItem')

      cy.contains('button', 'Launch Chrome').should('be.visible')

      cy.intercept('mutation-OpenBrowserList_SetBrowser').as('setBrowser')

      cy.get('@firefoxItem').then(($input) => {
        cy.get(`label[for=${$input.attr('id')}]`).click().then(() => {
          cy.wait('@setBrowser').its('request.body.variables.id').should('eq', $input.attr('id'))
        })
      })

      cy.findByRole('radio', { name: 'Chrome v1.x', checked: false })
      cy.findByRole('radio', { name: 'Firefox v2.x', checked: true })

      cy.contains('button', 'Launch Firefox').should('be.visible')
    })
  })

  describe('No System Browsers Detected', () => {
    beforeEach(() => {
      setupZeroMockBrowsers()
    })

    it('does not show browser list when no browsers are detected', () => {
      cy.openProject('launchpad', ['--e2e'])

      cy.visitLaunchpad()

      stepThroughConfigPages()

      cy.get('h1').should('contain', 'Choose a Browser')

      cy.get('[data-cy="open-browser-list"]').children().should('have.length', 0)
      cy.contains('button', 'Back').should('be.visible').and('not.be.disabled')
    })
  })
})