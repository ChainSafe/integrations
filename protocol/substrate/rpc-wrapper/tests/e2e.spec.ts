import {
  Substrate_Module as S,
  // Substrate_BlockOutput,
  // Substrate_ChainMetadata,
  // Substrate_RuntimeVersion,
  Substrate_AccountInfo,
} from "./wrap";
import { ClientConfig, PolywrapClient, Uri } from "@polywrap/client-js";
// import { runCLI, buildWrapper, initTestEnvironment, stopTestEnvironment, providers } from "@polywrap/test-env-js";
import { injectExtension } from '@polkadot/extension-inject';
import path from "path";
// import { up, down } from "substrate-polywrap-test-env";
import { enableFn } from "mock-polkadot-js-extension";
import { substrateSignerProviderPlugin } from "substrate-signer-provider-plugin-js";

jest.setTimeout(360000);
let url: string;

describe("e2e", () => {
  let client: PolywrapClient;
  const uri = new Uri("fs/" + path.join(__dirname, "../build")).uri;

  beforeAll(async () => {

    // start up a test chain environment
    // console.log("Starting up test chain. This can take around 1 minute..");
    // const response = await up(false);
    // url = response.node.url;
    // console.log("Test chain running at ", url);
    url = "http://localhost:9933"

    console.log(uri);

    // const wrapperDir = path.resolve(__dirname, "../");

    // const buildOutput = await runCLI({
    //   args: ["build"],
    //   cwd: wrapperDir
    // });

    // if (buildOutput.exitCode !== 0) {
    //   throw Error(
    //     `Failed to build wrapper:\n` +
    //     JSON.stringify(buildOutput, null, 2)
    //   );
    // }

    // injects the mock extension into the page
    await injectExtension(enableFn, { name: 'mockExtension', version: '1.0.0' });


    const clientConfig: Partial<ClientConfig> = {
      plugins: [
        {
          uri: uri,
          plugin: substrateSignerProviderPlugin({})
        }
      ]
    };

    client = new PolywrapClient(clientConfig);
  });

  afterAll(async () => {
    // await down();
  })

  it("can retreve signer provider accounts", async () => {
    const result = await S.getSignerProviderAccounts(
      {},
      client,
      uri
    );

    expect(result.error).toBeFalsy();
    expect(result.data).toBeTruthy();
    console.log(result.data);
  });

  it("blockHash", async () => {
    const result = await S.blockHash({
        url,
        number: 0
      },
      client,
      uri
    );

    expect(result.error).toBeFalsy();
    expect(result.data).toBeTruthy();
    console.log(result.data);
  });

  // it("retrieves genesis block parent hash is 00000", async () => {
  //   const result = await S.chainGetBlock({
  //       url,
  //       number: 0
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.error).toBeFalsy();
  //   expect(result.data).toBeTruthy();
  //   const block: Substrate_BlockOutput = result.data!;
  //   expect(block.block).toBeTruthy();

  //   const json_block = JSON.parse(block.block);
  //   // The parent hash of genesis is always 00000
  //   expect(json_block.block.header.parentHash).toStrictEqual("0x0000000000000000000000000000000000000000000000000000000000000000");
  // });

  // it("retrieves the chain metadata", async () => {
  //   const result = await S.chainGetMetadata({
  //       url
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.error).toBeFalsy();
  //   expect(result.data).toBeTruthy();

  //   const chainMetadata: Substrate_ChainMetadata = result.data!;
  //   expect(chainMetadata.metadata).toBeTruthy();
  //   expect(chainMetadata.pallets).toBeTruthy();
  //   expect(chainMetadata.events).toBeTruthy();
  //   expect(chainMetadata.errors).toBeTruthy();
  // });

  // it("state get runtime version", async () => {
  //   const result = await S.getRuntimeVersion({
  //       url
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.data).toBeTruthy();
  //   expect(result.error).toBeFalsy();
  //   const runtimeVersion: Substrate_RuntimeVersion = result.data!;
  //   expect(runtimeVersion.spec_name).toStrictEqual("forum-node");
  //   expect(runtimeVersion.impl_name).toStrictEqual("forum-node");
  //   expect(runtimeVersion.authoring_version).toStrictEqual(1);
  //   expect(runtimeVersion.spec_version).toStrictEqual(100);
  //   expect(runtimeVersion.impl_version).toStrictEqual(1);
  //   expect(runtimeVersion.state_version).toStrictEqual(1);
  // });


  // it("storage value", async () => {
  //   const result = await S.getStorageValue({
  //      url,
  //       pallet: "TemplateModule",
  //       storage: "Something"
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result).toBeTruthy();
  //   expect(result.error).toBeFalsy();
  //   expect(result.data).toBeFalsy();
  // });

  // it("return constant values", async () => {
  //   const result = await S.constant({
  //      url,
  //       pallet: "Balances",
  //       name: "ExistentialDeposit"
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result).toBeTruthy();
  //   expect(result.error).toBeFalsy();
  //   expect(result.data).toBeTruthy();
  //   expect(result.data).toStrictEqual([
  //     244, 1, 0, 0, 0, 0,
  //       0, 0, 0, 0, 0, 0,
  //       0, 0, 0, 0
  //   ]);
  // });

  // it("rpc_methods", async () => {
  //   const result = await S.rpcMethods({
  //       url,
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.error).toBeFalsy();
  //   expect(result.data).toBeTruthy();
  //   const methods = result.data!;
  //   //There are 85 rpc methods exposed in `examples/substrate-note-template`
  //   expect(methods.length).toStrictEqual(85);
  // });

  // it("get storage maps", async () => {
  //   const result = await S.getStorageMap({
  //       url,
  //       pallet: "ForumModule",
  //       storage: "AllPosts",
  //       key: "0",
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.error).toBeFalsy();
  //   expect(result).toBeTruthy();
  // });


  // it("get storage maps paged", async () => {
  //   const result = await S.getStorageMapPaged({
  //       url,
  //       pallet: "ForumModule",
  //       storage: "AllPosts",
  //       count: 10,
  //       nextTo: null,
  //     },
  //     client,
  //     uri
  //   );

  //   expect(result.error).toBeFalsy();
  //   expect(result).toBeTruthy();
  // });

  it("get account info of Alice", async () => {
    const result = await S.accountInfo({
        url,
        //Alice account
        account: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      },
      client,
      uri
    );

    expect(result).toBeTruthy();
    expect(result.error).toBeFalsy();
    expect(result.data).toBeTruthy();

    const account_info: Substrate_AccountInfo = result.data!;
    console.log("account info: ", account_info);
  });
});
