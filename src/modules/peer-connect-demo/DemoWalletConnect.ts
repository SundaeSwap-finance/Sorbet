import { CardanoPeerConnect, ExperimentalContainer } from "@fabianbormann/cardano-peer-connect";
import {
  Cbor,
  Cip30DataSignature,
  IWalletInfo,
  Paginate,
} from "@fabianbormann/cardano-peer-connect/dist/src/types";

export class DemoWalletConnect extends CardanoPeerConnect {
  private syncTest = (paramA: string, paramB: number) => {
    return `Called test with ${paramA} and number ${paramB}`;
  };

  private async asyncTest<T>(arg: T): Promise<T> {
    console.log("asyncTest called with: ", arg);
    return arg;
  }
  constructor(
    walletInfo: IWalletInfo,
    seed: string | null,
    announce: string[],
    discoverySeed?: string | null
  ) {
    super(walletInfo, {
      seed: seed,
      announce: announce,
      discoverySeed: discoverySeed,
      logLevel: "debug",
    });

    //these functions and properties will be available under window.cardano['walletname'].experimental
    this.setExperimentalApi(
      new ExperimentalContainer({
        ABasicDataType: 1.234, //you can add basic data types, numbers, string, etc.

        basicObject: {
          //more complex objects
          stringValue: "A test string",
          numberValue: "String",
          arrayA: ["A", "B", 3],
          // Don't declare functions in here
          // this will not work as expected:
          // myfunc: () => { return  "ABC" }
        },
        //declare functions as first class properties. Notice they will always be transformed into async function on the dapp
        myfunc: () => {
          return "ABC";
        },

        //or import them, they can be normal and asynchronous functions
        syncTest: this.syncTest,
        asyncTest: this.asyncTest,
      })
    );

    //these functions and properties will be available under (await window.cardano['walletname'].enable()).experimental
    this.setEnableExperimentalApi(
      new ExperimentalContainer({
        property: "Property ABC", // just like in setExperimentalApi you can add most things in here

        anotherProperty: "Property 2",

        asyncTest: this.asyncTest,

        asyncAddition: (numA: number, numB: number): Promise<number> => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(numA + numB);
            }, 1000);
          });
        },
      })
    );
  }

  async getRewardAddresses(): Promise<Cbor[]> {
    const rewardAddresses = ["e1820506cb0ce54ae755b2512b6cf31856d7265e8792cb86afc94e0872"];

    return rewardAddresses;
  }

  async getNetworkId(): Promise<number> {
    return 1;
  }

  async getUtxos(
    amount?: string | undefined,
    paginate?: Paginate | undefined
  ): Promise<string[] | null> {
    return [
      "1111182012217928d1b72b4324fc274a0b26f3bfc96c00002df3da8c7118c858c7aa136fa7b2b1baa3e81ed1a03b795000",
      "....",
    ];
  }

  async getCollateral(
    params?: { amount?: string | undefined } | undefined
  ): Promise<string[] | null> {
    return ["aaaaaaa1e18de8b01f0790.....aa136fa7b2b1baa3e81ed1a004c4b40", "..."];
  }

  async getBalance(): Promise<string> {
    return "00";
  }

  async getUsedAddresses(): Promise<string[]> {
    return [];
  }

  async getUnusedAddresses(): Promise<string[]> {
    return [];
  }

  async getChangeAddress(): Promise<string> {
    return "123abc...00000";
  }

  async signTx(txParam: string, partialSign: boolean): Promise<string> {
    // build tx witness set
    const witnessSet = ((txParams: string, partialSign: boolean) => {
      return "aaa....bbb"; //
    })(txParam, partialSign);

    if (witnessSet) {
      return witnessSet;
    } else {
      throw new Error("No witness set created.");
    }
  }

  async signData(addr: string, payload: string): Promise<Cip30DataSignature> {
    //similar error handling as in signTx
    if (window.confirm(`Do you want to sign: ${payload}`)) {
      const toHex = (text: string) =>
        text
          .split("")
          .map((char) => char.charCodeAt(0).toString(16))
          .join("");

      return {
        key: toHex(addr),
        signature: toHex(payload),
      };
    } else {
      throw new Error("DataSignError");
    }
  }

  async submitTx(tx: Cbor): Promise<string> {
    const txHash = ((cbor: string) => {
      //submit tx and return tx hash if submitted
      return "aaaa";
    })(tx);

    if (!txHash) {
      throw new Error("Tx not submitted.");
    }

    return txHash;
  }
}
