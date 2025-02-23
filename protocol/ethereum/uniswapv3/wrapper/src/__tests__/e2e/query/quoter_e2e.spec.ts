import { Token, ChainIdEnum, FeeAmountEnum, Pool, Trade, TradeTypeEnum, MethodParameters } from "../types";
import {
  encodeSqrtRatioX96,
  createPool,
  createTradeFromRoute,
  getTickAtSqrtRatio,
  nearestUsableTick,
  feeAmountToTickSpacing,
  constant,
  createRoute,
  quoteCallParameters
} from "../wrappedQueries";
import { ClientConfig, Web3ApiClient } from "@web3api/client-js";
import { buildAndDeployApi, initTestEnvironment, stopTestEnvironment } from "@web3api/test-env-js";
import { getPlugins } from "../testUtils";
import path from "path";

jest.setTimeout(120000);

const makePool = async (client: Web3ApiClient, ensUri: string, token0: Token, token1: Token) => {
  const feeAmount = FeeAmountEnum.MEDIUM;
  const liquidity = 1_000_000;
  const tickSpacing = await feeAmountToTickSpacing(client, ensUri, feeAmount);
  const tickIndex0 = await nearestUsableTick(client, ensUri, await constant<number>(client, ensUri, "MIN_TICK"), tickSpacing);
  const tickIndex1 = await nearestUsableTick(client, ensUri, await constant<number>(client, ensUri, "MAX_TICK"), tickSpacing);
  const sqrtRatioX96 = await encodeSqrtRatioX96(client, ensUri, 1, 1);
  const tickCurrent = await getTickAtSqrtRatio(client, ensUri, sqrtRatioX96);
  return createPool(client, ensUri, token0, token1, feeAmount, sqrtRatioX96, liquidity, tickCurrent, [
    {
      index: tickIndex0,
      liquidityNet: liquidity.toString(),
      liquidityGross: liquidity.toString()
    },
    {
      index: tickIndex1,
      liquidityNet: (-liquidity).toString(),
      liquidityGross: liquidity.toString()
    }
  ]);
};

const token0: Token = {
  chainId: ChainIdEnum.MAINNET,
  address: "0x0000000000000000000000000000000000000001",
  currency: {
    decimals: 18,
    symbol: "t0",
    name: "token0",
  }
}
const token1: Token = {
  chainId: ChainIdEnum.MAINNET,
  address: "0x0000000000000000000000000000000000000002",
  currency: {
    decimals: 18,
    symbol: "t1",
    name: "token1",
  }
}
const WETH: Token = {
  chainId: ChainIdEnum.MAINNET,
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  currency: {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
  },
};
let pool_0_1: Pool;
let pool_1_weth: Pool;

describe('SwapQuoter', () => {


  let client: Web3ApiClient;
  let ensUri: string;

  beforeAll(async () => {
    const { ipfs, ethereum, ensAddress, registrarAddress, resolverAddress } = await initTestEnvironment();
    // get client
    const config: ClientConfig = getPlugins(ethereum, ipfs, ensAddress);
    client = new Web3ApiClient(config);
    // deploy api
    const apiPath: string = path.resolve(__dirname + "/../../../../");
    const api = await buildAndDeployApi({
      apiAbsPath: apiPath,
      ipfsProvider: ipfs,
      ensRegistryAddress: ensAddress,
      ethereumProvider: ethereum,
      ensRegistrarAddress: registrarAddress,
      ensResolverAddress: resolverAddress,
    });
    ensUri = `ens/testnet/${api.ensDomain}`;
    // set up test case data
    pool_0_1 = await makePool(client, ensUri, token0, token1);
    pool_1_weth = await makePool(client, ensUri, token1, WETH);
  });

  afterAll(async () => {
    await stopTestEnvironment();
  });

  describe('quoter swapCallParameters', () => {
    describe('single trade input', () => {
      it('single-hop exact input', async () => {
        const trade: Trade = await createTradeFromRoute(client, ensUri,{
            route: await createRoute(client, ensUri, [pool_0_1], token0, token1 ),
            amount: {
              token: token0,
              amount: "100",
            }
          },
          TradeTypeEnum.EXACT_INPUT
        );
        const params: MethodParameters = await quoteCallParameters(client, ensUri,
          trade.swaps[0].route,
          trade.inputAmount,
          trade.tradeType
        );

        expect(params.calldata).toStrictEqual(
          '0xf7729d43000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000'
        );
        expect(params.value).toStrictEqual('0x00');
      });

      it('single-hop exact output', async () => {
        const trade: Trade = await createTradeFromRoute(client, ensUri,{
            route: await createRoute(client, ensUri, [pool_0_1], token0, token1 ),
            amount: {
              token: token1,
              amount: "100",
            }
          },
          TradeTypeEnum.EXACT_OUTPUT
        );
        const params: MethodParameters = await quoteCallParameters(client, ensUri,
          trade.swaps[0].route,
          trade.outputAmount,
          trade.tradeType
        );

        expect(params.calldata).toBe(
          '0x30d07f21000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000'
        );
        expect(params.value).toBe('0x00');
      });

      it('multi-hop exact input', async () => {
        const trade: Trade = await createTradeFromRoute(client, ensUri,{
            route: await createRoute(client, ensUri, [pool_0_1, pool_1_weth], token0, WETH ),
            amount: {
              token: token0,
              amount: "100",
            }
          },
          TradeTypeEnum.EXACT_INPUT
        );
        const params: MethodParameters = await quoteCallParameters(client, ensUri,
          trade.swaps[0].route,
          trade.inputAmount,
          trade.tradeType
        );

        expect(params.calldata).toBe(
          '0xcdca17530000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000420000000000000000000000000000000000000001000bb80000000000000000000000000000000000000002000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000'
        );
        expect(params.value).toBe('0x00');
      });

      it('multi-hop exact output', async () => {
        const trade: Trade = await createTradeFromRoute(client, ensUri,{
            route: await createRoute(client, ensUri, [pool_0_1, pool_1_weth], token0, WETH ),
            amount: {
              token: WETH,
              amount: "100",
            }
          },
          TradeTypeEnum.EXACT_OUTPUT
        );
        const params: MethodParameters = await quoteCallParameters(client, ensUri,
          trade.swaps[0].route,
          trade.outputAmount,
          trade.tradeType
        );

        expect(params.calldata).toBe(
          '0x2f80bb1d000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000042c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000bb80000000000000000000000000000000000000002000bb80000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000'
        );
        expect(params.value).toBe('0x00');
      });

      it('sqrtPriceLimitX96', async () => {
        const trade: Trade = await createTradeFromRoute(client, ensUri,{
            route: await createRoute(client, ensUri, [pool_0_1], token0, token1 ),
            amount: {
              token: token0,
              amount: "100",
            }
          },
          TradeTypeEnum.EXACT_INPUT
        );
        const params: MethodParameters = await quoteCallParameters(client, ensUri,
          trade.swaps[0].route,
          trade.inputAmount,
          trade.tradeType,
          {
          sqrtPriceLimitX96: "340282366920938463463374607431768211456",
          },
        );

        expect(params.calldata).toBe(
          '0xf7729d43000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000100000000000000000000000000000000'
        );
        expect(params.value).toBe('0x00');
      });
    });
  });
});
