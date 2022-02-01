/* eslint-disable import/no-extraneous-dependencies */
import { query, mutation } from "./resolvers";
import { manifest, Query, Mutation } from "./w3";
import * as Types from "./w3";
import {
  Address,
  AccountIndex,
  InMemorySigner,
  TezosProvider,
  Connection,
  Connections,
  ConnectionConfig,
  ConnectionConfigs,
} from "./Connection";
import * as Mapping from "./mapping";

import {
  Client,
  Plugin,
  PluginPackageManifest,
  PluginFactory,
} from "@web3api/core-js";
import { TransactionOperation, MichelsonMap, BigMapAbstraction } from "@taquito/taquito";
import { char2Bytes } from "@taquito/utils";
import { TempleWallet, TempleDAppNetwork } from "@temple-wallet/dapp"
import { getOperation } from "./indexer";

// Export all types that are nested inside of TezosConfig.
// This is required for the extractPluginConfigs.ts script.
export {
  Address,
  AccountIndex,
  InMemorySigner,
  TezosProvider,
  ConnectionConfig,
  ConnectionConfigs,
};

export interface TezosConfig {
  networks: ConnectionConfigs;
  defaultNetwork?: string;
}

export class TezosPlugin extends Plugin {
  private _connections: Connections;
  private _defaultNetwork: string;

  constructor(config: TezosConfig) {
    super();
    this._connections = Connection.fromConfigs(config.networks);

    // Assign the default network (mainnet if not provided)
    if (config.defaultNetwork) {
      this._defaultNetwork = config.defaultNetwork;
    } else {
      this._defaultNetwork = "mainnet";
    }

    // Create a connection for the default network if none exists
    if (!this._connections[this._defaultNetwork]) {
      this._connections[this._defaultNetwork] = Connection.fromNetwork(
        this._defaultNetwork
      );
    }
  }

  public static manifest(): PluginPackageManifest {
    return manifest;
  }

  public getModules(
    _client: Client
  ): {
    query: Query.Module;
    mutation: Mutation.Module;
  } {
    return {
      query: query(this),
      mutation: mutation(this),
    };
  }

  // Mutation
  public async callContractMethod(
    input: Mutation.Input_callContractMethod
  ): Promise<Types.TxOperation> {
    const transactionOperation = await this._callContractMethod(input);
    return Mapping.toTxOperation(transactionOperation);
  }

  public async callContractMethodAndConfirmation(
    input: Mutation.Input_callContractMethodAndConfirmation
  ): Promise<Types.CallContractMethodConfirmationResponse> {
    const res = await this._callContractMethod(input);
    const initialConfirmation = input.confirmations ? input.confirmations : 0;
    const interval = input.interval ? input.interval : 10;
    const timeout = input.timeout ? input.timeout : 180;
    const finalConfirmation = await res.confirmation(initialConfirmation, interval, timeout);
    return {
      confirmation: finalConfirmation,
      operation: Mapping.toTxOperation(res),
    };
  }

  public async transfer(input: Mutation.Input_transfer): Promise<string> {
    const connection = await this.getConnection(input.connection);
    const transferParams = Mapping.fromTransferParams(input.params);
    const transferOperation = await connection
      .getProvider()
      .wallet.transfer(transferParams);
    const walletOperation = await transferOperation.send();
    return walletOperation.opHash;
  }

  public async transferAndConfirm(
    input: Mutation.Input_transferAndConfirm
  ): Promise<Types.TransferConfirmation> {
    const connection = await this.getConnection(input.connection);
    const transferParams = Mapping.fromTransferParams(input.params);
    const transactionWalletOperation = await connection
      .getProvider()
      .wallet.transfer(transferParams);
    const confirmationResponse = await (
      await transactionWalletOperation.send()
    ).confirmation(input.confirmations);
    return Mapping.toTransferConfirmation(confirmationResponse);
  }

  public async signMessage(
    input: Mutation.Input_signMessage
  ): Promise<Types.SignResult> {
    const connection = await this.getConnection(input.connection);
    const bytes = char2Bytes(input.message);
    const result = await connection.getSigner().sign(bytes);
    return Mapping.toSignResult(result);
  }

  public async originate(
    input: Mutation.Input_originate
  ): Promise<Types.OriginationResponse> {
    try {
      const connection = await this.getConnection(input.connection);
      const originateParams = Mapping.fromOriginateParams(input.params);
      const originationOperation = await connection
        .getProvider()
        .contract.originate(originateParams);
      return {
        error: false,
        origination: Mapping.toOriginationOperation(originationOperation),
      };
    } catch (error) {
      return {
        error: true,
        reason: error.message,
      };
    }
  }

  public async originateAndConfirm(
    input: Mutation.Input_originateAndConfirm
  ): Promise<Types.OriginationConfirmationResponse> {
    const connection = await this.getConnection(input.connection);
    const originateParams = Mapping.fromOriginateParams(input.params);
    const originationOperation = await connection
      .getProvider()
      .contract.originate(originateParams);
    const initialConfirmation = input.confirmations
      ? input.confirmations
      : 0;
    const interval = input.interval ? input.interval : 10;
    const timeout = input.timeout ? input.timeout : 180;
    const finalConfirmation = await originationOperation.confirmation(
      initialConfirmation,
      interval,
      timeout
    );
    return {
      confirmation: finalConfirmation,
      origination: Mapping.toOriginationOperation(originationOperation),
    };
  }

  public async connectTempleWallet(
    input: Mutation.Input_connectTempleWallet
  ): Promise<boolean> {
    const isAvailable = await TempleWallet.isAvailable();
    if (!isAvailable) {
      throw new Error('Temple Wallet is not available.');
    }
    const connection = await this.getConnection(input.connection);
    const wallet = new TempleWallet(input.appName);
    await wallet.connect(<TempleDAppNetwork>input.network);
    connection.getProvider().setWalletProvider(wallet);
    return wallet.connected;
  }

  public async walletContractCallMethod(
    input: Mutation.Input_walletContractCallMethod
  ): Promise<string> {
    const connection = await this.getConnection(input.connection);
    const contract = await connection.getProvider().wallet.at(input.address);
    const walletOperation = await contract.methods[input.method](...this.parseArgs(input.args)).send();
    return walletOperation.opHash;
  }

  public async walletOriginate(
    input: Mutation.Input_walletOriginate
  ): Promise<string> {
    const connection = await this.getConnection(input.connection);
    const originateParams = Mapping.fromOriginateParams(input.params);
    const originateWalletOperation = await connection.getProvider()
      .wallet
      .originate(originateParams)
      .send();
    return originateWalletOperation.opHash;
  }

  // Query
  public async getWalletPKH(input: Query.Input_getWalletPKH): Promise<string> {
    const connection = await this.getConnection(input.connection);
    return await connection.getProvider().wallet.pkh();
  }

  public async getOperationStatus(input: Query.Input_getOperationStatus): Promise<Types.OperationStatus> {
    const network = input.network.toString().toLowerCase();
    const response = await getOperation(network, input.hash);
    return Mapping.toOperationStatus(response);
  }

  public async getPublicKey(input: Query.Input_getPublicKey): Promise<string> {
    const connection = await this.getConnection(input.connection);
    return await connection.getSigner().publicKey();
  }

  public async getPublicKeyHash(
    input: Query.Input_getPublicKeyHash
  ): Promise<string> {
    const connection = await this.getConnection(input.connection);
    return await connection.getSigner().publicKeyHash();
  }

  public async getRevealEstimate(
    input: Query.Input_getRevealEstimate
  ): Promise<Types.EstimateResult> {
    try {
      const connection = await this.getConnection(input.connection);
      const revealParams = Mapping.fromRevealParams(input.params);
      const estimate = await connection
        .getProvider()
        .estimate.reveal(revealParams);
      if (!estimate) {
        throw Error("account is already revealed");
      }
      return {
        error: false,
        estimate: Mapping.toEstimate(estimate),
      };
    } catch (error) {
      return {
        error: true,
        reason: error.message,
      };
    }
  }

  public async getTransferEstimate(
    input: Query.Input_getTransferEstimate
  ): Promise<Types.EstimateResult> {
    try {
      const connection = await this.getConnection(input.connection);
      const transferParams = Mapping.fromTransferParams(input.params);
      const estimate = await connection
        .getProvider()
        .estimate.transfer(transferParams);
      return {
        error: false,
        estimate: Mapping.toEstimate(estimate),
      };
    } catch (error) {
      return {
        error: true,
        reason: error.message,
      };
    }
  }

  public async getOriginateEstimate(
    input: Query.Input_getOriginateEstimate
  ): Promise<Types.EstimateResult> {
    try {
      const connection = await this.getConnection(input.connection);
      const originateParams = Mapping.fromOriginateParams(input.params);
      const estimate = await connection
        .getProvider()
        .estimate.originate(originateParams);
      return {
        error: false,
        estimate: Mapping.toEstimate(estimate),
      };
    } catch (error) {
      return {
        error: true,
        reason: error.message,
      };
    }
  }

  public async checkAddress(input: Query.Input_checkAddress): Promise<boolean> {
    try {
      const connection = await this.getConnection(input.connection);
      const balance = await connection
        .getProvider()
        .tz.getBalance(input.address);
      if (!balance.toString()) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  public async getBalance(input: Query.Input_getBalance): Promise<string> {
    const connection = await this.getConnection(input.connection);
    const balance = await connection.getProvider().tz.getBalance(input.address);
    return balance.toString();
  }

  public async getContractStorage(input: Query.Input_getContractStorage): Promise<string> {
    const connection = await this.getConnection(input.connection);
    const contract = await connection.getProvider().contract.at(input.address)
    const storage = await contract.storage();
    // @ts-ignore
    let data = storage[input.key];
    if(!!input.field) {
      let field = input.field;
      try {
        field = JSON.parse(<string>input.field);
      } catch (error) {
        // ignore if parsing string fails
      }
      if (data instanceof BigMapAbstraction) {
        data = await data.get(field);
      } else {
        data = data[field];
      }
    }
    return this.stringifyStorage(data);
  }

  // Utils
  public async getConnection(
    connection?: Types.Connection | null
  ): Promise<Connection> {
    if (!connection) {
      return this._connections[this._defaultNetwork];
    }
    const { networkNameOrChainId, provider } = connection;
    let result: Connection;
    // If a custom network is provided, either get an already
    // established connection, or a create a new one
    if (networkNameOrChainId) {
      const networkStr = networkNameOrChainId.toLowerCase();
      if (this._connections[networkStr]) {
        result = this._connections[networkStr];
      } else {
        result = Connection.fromNetwork(networkStr);
      }
    } else {
      result = this._connections[this._defaultNetwork];
    }
    // If a custom node endpoint is provided, create a combined
    // connection with the node's endpoint and a connection's signer
    // (if one exists for the network)
    if (provider) {
      const nodeConnection = Connection.fromNode(provider);
      const nodeNetwork = nodeConnection.getProvider().rpc;
      const chainId = await nodeNetwork.getChainId();
      const establishedConnection = this._connections[chainId];
      if (establishedConnection) {
        try {
          nodeConnection.setSigner(establishedConnection.getSigner());
        } catch (e) {
          // It's okay if there isn't a signer available.
        }
      }
      result = nodeConnection;
    }
    return result;
  }

  public parseArgs(args?: string | null): unknown[] {
    if (!args) {
      return [];
    }
    return JSON.parse(args);
  }

  private async _callContractMethod(
    input: Mutation.Input_callContractMethod
  ): Promise<TransactionOperation> {
    const connection = await this.getConnection(input.connection);
    const contract = await connection.getContract(input.address);
    return contract.methods[input.method](...this.parseArgs(input.args)).send();
  }

  private stringifyStorage(output: any): string {
    switch (typeof output) {
      case "number":
      case "string":
      case "boolean":
        output = output.toString();
        break;
      case "object":
        if (typeof output.valueOf() === 'string') {
          output = output.valueOf();
          break;
        }
        if (MichelsonMap.isMichelsonMap(output)) {
          const values = Object.fromEntries(output['valueMap']);
          output = JSON.stringify(values);
          break;
        }
        const keys = Object.keys(output)
        if (keys.length > 0) {
          let out: Record<string, any> = {};
          for (const key of keys) {
            out[key] = this.stringifyStorage(output[key]);
          }
          output = JSON.stringify(out);
        }
        break;
      default:
        throw new Error(`type '${typeof output}' is not supported while parsing storage`);   
    }
    return output;
  }
}

export const tezosPlugin: PluginFactory<TezosConfig> = (opts: TezosConfig) => {
  return {
    factory: () => new TezosPlugin(opts),
    manifest: manifest,
  };
};
export const plugin = tezosPlugin;
