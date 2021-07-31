import { mount, CyMountOptions } from '@cypress/vue'
import { provideClient, TypedDocumentNode } from '@urql/vue'
import { testApolloClient } from './testApolloClient'
import { ClientTestContext } from '@packages/server/lib/graphql/context/ClientTestContext'
import { Component } from 'vue'

/**
 * This variable is mimicing ipc provided by electron.
 * It has to be loaded run before initializing GraphQL
 * because graphql uses it.
 */
(window as any).ipc = {
  on: () => {},
  send: () => {},
}

type SetupContext = (ctx: ClientTestContext) => ClientTestContext | void

type SetupContextOpts = {
  setupContext?: SetupContext
}

Cypress.Commands.add(
  'mount',
  <C extends Component>(comp: C, options: CyMountOptions<C> & SetupContextOpts) => {
    const { setupContext, ...rest } = options

    options = options || {}
    options.global = options.global || {}

    options.global.plugins = options.global.plugins || []
    options.global.plugins.push({
      install () {
        const testCtx = new ClientTestContext()
        const ctx = setupContext ? setupContext(testCtx) : testCtx

        provideClient(testApolloClient(ctx || testCtx))
      },
    })

    return mount(comp, rest)
  },
)

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Install all vue plugins and globals then mount
       */
      mount<Props = any>(comp: Component<Props>, options?: CyMountOptions<Props> & SetupContextOpts): Cypress.Chainable<any>
      /**
       * Executes a fragment query
       */
      testQuery<Result, Variables>(source: TypedDocumentNode<Result, Variables>, testContext?: ClientTestContext): Cypress.Chainable<Result>
    }
  }
}