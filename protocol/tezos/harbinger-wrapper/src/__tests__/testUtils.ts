import { ensPlugin } from "@web3api/ens-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ethereumPlugin  } from "@web3api/ethereum-plugin-js"
import { PluginRegistration } from "@web3api/client-js"

export const getPlugins = (ipfs: string, ensAddress: string, ethereum: string): PluginRegistration<string>[] => {
    return [
        {
            uri: "w3://ens/ipfs.web3api.eth",
            plugin: ipfsPlugin({ provider: ipfs }),
        },
        {
            uri: "w3://ens/ens.web3api.eth",
            plugin: ensPlugin({ query: { addresses: { testnet: ensAddress } } }),
        },
        {
            uri: "w3://ens/ethereum.web3api.eth",
            plugin: ethereumPlugin({
                networks: {
                    testnet: {
                        provider: ethereum
                    },
                },
                defaultNetwork: "testnet"
            }),
        },
    ]
}