import { web3Accounts, web3Enable, web3FromSource } from '@polkadot/extension-dapp';
import { u8aToHex, hexToU8a } from '@polkadot/util';
//import { signatureVerify } from '@polkadot/util-crypto'
const { signatureVerify } = require('@polkadot/util-crypto');


function hex2a(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
        var v = parseInt(hex.substr(i, 2), 16);
        if (v) str += String.fromCharCode(v);
    }
    return str;
}  

export class SignerProvider {

    async init(){
      await web3Enable('forum-app');
    }

    async signer_accounts(){
        await this.init();
        let accounts = await web3Accounts();
        console.log("accounts: ", accounts);
        return accounts
    }

    async sign_payload(payload){
        await this.init();
        let accounts = await web3Accounts();

        let payload_str = hex2a(payload);
        console.log("payload_str:", payload_str);

        let payload_u8 = hexToU8a(payload);
        console.log("payload_u8:", payload_u8);

        // `account` is of type InjectedAccountWithMeta 
        // We arbitrarily select the first account returned from the above snippet
        const account = accounts[0];

        // to be able to retrieve the signer interface from this account
        // we can use web3FromSource which will return an InjectedExtension type
        const injector = await web3FromSource(account.meta.source);

        // this injector object has a signer and a signRaw method
        // to be able to sign raw bytes
        const signRaw = injector?.signer?.signRaw;

        if (!!signRaw) {
            // after making sure that signRaw is defined
            // we can use it to sign our message
            const { signature } = await signRaw({
                address: account.address,
                data: payload_u8,
                type: 'bytes'
            });
            


            console.log("js argument payload:", payload);
            console.error("js argument signature: ", signature);
            console.log("js argument account address:", account.address);
            const isValid = signatureVerify(payload, signature, account.address);
            console.log("js signature valid ", isValid);

            return signature;
        }
    }
}

window.SignerProvider = SignerProvider;
