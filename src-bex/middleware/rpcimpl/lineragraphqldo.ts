import { sharedStore } from '../../../src-bex/store'
import axios from 'axios'
import {
  RpcMethod,
  RpcRequest,
  RpcGraphqlQuery,
  lineraGraphqlOperation,
  GraphqlOperation
} from '../types'
import { SubscriptionClient } from 'graphql-subscriptions-client'
import { basebridge } from '../../../src-bex/event'
import { subscription } from '../../subscription'
import type { Json } from '@metamask/utils'
import * as lineraWasm from '../../../src-bex/wasm/linera_wasm'
import { db, rpc } from '../../../src/model'
import { v4 as uuidv4 } from 'uuid'

interface RpcRequestAttr {
  needChainId: boolean
}

const RpcRequestAttrs: Map<RpcMethod, RpcRequestAttr> = new Map<
  RpcMethod,
  RpcRequestAttr
>([
  [
    RpcMethod.ETH_SIGN,
    {
      needChainId: false
    }
  ]
])

const queryUrl = async (microchain: string, query: RpcGraphqlQuery) => {
  let graphqlUrl: string
  try {
    graphqlUrl = await sharedStore.getRpcEndpoint()
  } catch (e) {
    return await Promise.reject(e)
  }
  if (!graphqlUrl) {
    return await Promise.reject('Invalid graphql endpoint')
  }
  if (query.applicationId) {
    graphqlUrl +=
      '/checko/chains/' + microchain + '/applications/' + query.applicationId
  }
  return graphqlUrl
}

const queryDo = async (microchain: string, query: RpcGraphqlQuery) => {
  const graphqlUrl = await queryUrl(microchain, query)
  return new Promise((resolve, reject) => {
    axios({
      method: 'post',
      url: graphqlUrl,
      data: query.query
    })
      .then((res) => {
        if (!res.data) {
          return reject('Invalid response')
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if ((res.data.errors as unknown[])?.length) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return reject(new Error(JSON.stringify(res.data.errors)))
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        resolve(res.data.data)
      })
      .catch((e) => {
        reject(e)
      })
  })
}

const graphqlResponseKeyValue = (data: unknown, key: string) => {
  return (data as Record<string, unknown>)[key]
}

const graphqlResponseData = (result: unknown, key: string) => {
  return ((result as Record<string, unknown>).data as Record<string, unknown>)[
    key
  ]
}

const queryApplication = async (microchain: string, query: RpcGraphqlQuery) => {
  const graphqlUrl = await queryUrl(microchain, query)

  // TODO: we can serialize locally

  const variables = query.query.variables || {}
  variables.checko_query_only = true

  return new Promise((resolve, reject) => {
    axios
      .post(graphqlUrl, {
        query: query.query.query,
        variables,
        operationName: query.query.operationName
      })
      .then((res) => {
        const data = graphqlResponseData(res, 'data')
        const bytes = graphqlResponseKeyValue(
          data,
          query.query.operationName
        ) as Uint8Array
        resolve(bytes)
      })
      .catch((e) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Failed query application: ${e}`)
        reject(e)
      })
  })
}

const queryApplicationMutation = async (
  microchain: string,
  query: RpcGraphqlQuery
) => {
  const queryBytes = await queryApplication(microchain, query)

  const operation = {
    User: {
      application_id: query.applicationId,
      bytes: queryBytes
    }
  } as rpc.Operation
  const operationId = uuidv4()

  await sharedStore.createChainOperation({
    operationId,
    microchain,
    operationType: db.OperationType.ANONYMOUS,
    applicationId: query.applicationId,
    applicationType: db.ApplicationType.ANONYMOUS,
    operation: JSON.stringify(operation),
    state: db.OperationState.CREATED
  } as db.ChainOperation)

  return operationId
}

const parseSystemMutation = async (
  microchain: string,
  query: RpcGraphqlQuery
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion
  const operation = (await lineraWasm.graphql_deserialize_operation(
    query.query.query,
    JSON.stringify(query.query.variables)
  )) as string
  await sharedStore.createChainOperation({
    operationId: uuidv4(),
    microchain,
    operationType: db.OperationType.ANONYMOUS,
    applicationId: query.applicationId,
    applicationType: db.ApplicationType.ANONYMOUS,
    operation,
    state: db.OperationState.CREATED
  } as db.ChainOperation)
  return operation
}

const mutationDo = async (microchain: string, query: RpcGraphqlQuery) => {
  // If it's system operation, parse it
  // If it's application operation, construct bytes
  // TODO: for application operation, we need to get its wasm code blob, then load into wrap, get it service type definition, then feed to async graphql. This will be done in rust
  // Then, add operation to database, wait for block signer process it

  if (query.applicationId)
    return await queryApplicationMutation(microchain, query)
  return await parseSystemMutation(microchain, query)
}

const lineraGraphqlDoHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const query = request.request.params as unknown as RpcGraphqlQuery
  if (!query || !query.query) {
    return await Promise.reject('Invalid query')
  }
  const publicKey = query.publicKey
  const microchain = await sharedStore.getRpcMicrochain(
    request.origin,
    publicKey
  )
  if (!microchain) {
    return Promise.reject(new Error('Invalid microchain'))
  }
  if (!query.query.variables) {
    query.query.variables = {}
  }
  const attr = RpcRequestAttrs.get(request.request.method as RpcMethod)
  if (!attr || attr.needChainId) {
    query.query.variables.chainId = microchain
  }

  // If it's query, just query from endpoint

  const graphqlOperation = lineraGraphqlOperation(request)
  switch (graphqlOperation) {
    case GraphqlOperation.MUTATION:
      return mutationDo(microchain, query)
    case GraphqlOperation.QUERY:
      return queryDo(microchain, query)
  }
}

export const lineraGraphqlMutationHandler = async (request?: RpcRequest) => {
  return lineraGraphqlDoHandler(request)
}

export const lineraGraphqlQueryHandler = async (request?: RpcRequest) => {
  return lineraGraphqlDoHandler(request)
}

export const lineraGraphqlSubscribeHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const subscriptionId = subscription.Subscription.subscribe(
    request.request.params as string[],
    async (subscriptionId: string, data: unknown) => {
      const microchain = await sharedStore.getRpcMicrochain(request.origin, '')
      if (!microchain) {
        return Promise.reject(new Error('Invalid microchain'))
      }
      const _data = data as Record<
        string,
        Record<string, Record<string, string>>
      >
      if (microchain !== _data.data.notifications.chain_id) {
        return
      }
      void basebridge.EventBus.bridge?.send('linera_subscription', {
        subscriptionId,
        payload: _data.data
      } as subscription.SubscriptionPayload)
    }
  )
  return await Promise.resolve(subscriptionId)
}

export const lineraGraphqlUnsubscribeHandler = async (request?: RpcRequest) => {
  if (!request) {
    return await Promise.reject('Invalid request')
  }
  const subscriptionId = (
    request.request.params?.length
      ? (request.request.params as Json[])[0]
      : undefined
  ) as string
  if (!subscriptionId) {
    return await Promise.reject(new Error('Invalid subscription id'))
  }
  subscription.Subscription.unsubscribe(subscriptionId)
  return await Promise.resolve(subscriptionId)
}

export const setupLineraSubscription = async () => {
  const subscriptionEndpoint = await sharedStore.getSubscriptionEndpoint()
  const client = new SubscriptionClient(subscriptionEndpoint, {
    reconnect: true,
    lazy: true,
    connectionCallback: (e) => {
      if (e) {
        console.log('Subscribed', e)
      }
    }
  })
  const microchains = await sharedStore.getMicrochains()
  microchains.forEach((microchain) => {
    client
      .request({
        query: `subscription notifications($chainId: String!) {
        notifications(chainId: $chainId)
      }`,
        variables: {
          chainId: microchain
        }
      })
      .subscribe({
        next(data: unknown) {
          subscription.Subscription.handle(data)
        }
      })
  })
}
