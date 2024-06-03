import { CardanoPeerConnect } from "@fabianbormann/cardano-peer-connect";
import { LogLevel } from "@fabianbormann/cardano-peer-connect/dist/src/lib/Logger";
import { Cip30DataSignature, IConnectMessage, IDAppInfos, IWalletInfo, Paginate } from "@fabianbormann/cardano-peer-connect/dist/src/types";
import { Log } from "../utils/log_util";
import { ImpersonatedWallet } from "./ImpersonatedWallet.class";


const SORBET_VERSION = '1.0.1'
const SORBET_LOGO_BASE64 = 'data:image/png;base64,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'
const SORBET_WALLET_INFO: IWalletInfo = {
  name: 'sorbet_p2p', // must match name in cardano DOM object
  version: SORBET_VERSION,
  icon: SORBET_LOGO_BASE64,
  requestAutoconnect: true,
}

const announceEndpoints = {
  eternl: [
    "wss://tracker.de-0.eternl.art",
    "wss://tracker.us-0.eternl.art",
  ],
  peerConnectDemo: [
    'https://pro.passwordchaos.gimbalabs.io',
    'wss://tracker.files.fm:7073/announce',
    // 'wss://tracker.btorrent.xyz',
    'ws://tracker.files.fm:7072/announce',
    'wss://tracker.openwebtorrent.com:443/announce',
  ]
}

export type P2PConnectionState = 'disconnected' | 'connected' | 'connecting'

export type ConnectionStateChangeHandler = (
  p2pClient: CardanoPeerConnect | undefined, connectionState: P2PConnectionState, m: IConnectMessage
) => void

export interface P2PDapp extends IDAppInfos {
  identicon: string | null
}
export interface P2PConnection extends IConnectMessage {
  dApp: P2PDapp
}

export class SorbetPeerConnect extends CardanoPeerConnect {
  private w = new ImpersonatedWallet(false)

  constructor(
    seed?: string,
    options?: {
      walletInfo?: Partial<IWalletInfo>,
      announce?: string[],
      discoverySeed?: string,
      logLevel?: LogLevel,
    }
  ) {
    const { walletInfo, announce, discoverySeed, logLevel, } = options ?? {}
    super({ ...SORBET_WALLET_INFO, ...walletInfo, }, {
      seed,
      announce: announce ?? announceEndpoints.peerConnectDemo.concat(announceEndpoints.eternl),
      discoverySeed,
      logLevel: logLevel ?? 'info',
    });
  }

  private logP2PWalletMethod = () => {
    const stack = new Error().stack,
      caller = stack?.split('\n')[2].split('(')[0].trim();
    Log.App.P2PConnect("PeerConnectClient - executing wrapped wallet method:", caller);
  }

  protected getNetworkId(): Promise<number> {
    this.logP2PWalletMethod()
    return this.w.getNetworkId()
  }
  protected getUtxos(amount?: string | undefined, paginate?: Paginate | undefined): Promise<string[] | null> {
    this.logP2PWalletMethod()
    return this.w.getUtxos()
  }
  protected getCollateral(params?: { amount?: string | undefined; } | undefined): Promise<string[] | null> {
    this.logP2PWalletMethod()
    return this.w.getCollateral(params as { amount: string })
  }
  protected async getBalance(): Promise<string> {
    this.logP2PWalletMethod()
    return this.w.getBalance()
  }
  protected getUsedAddresses(): Promise<string[]> {
    this.logP2PWalletMethod()
    return this.w.getUsedAddresses()
  }
  protected getUnusedAddresses(): Promise<string[]> {
    this.logP2PWalletMethod()
    return this.w.getUnusedAddresses()
  }
  protected getChangeAddress(): Promise<string> {
    this.logP2PWalletMethod()
    return this.w.getChangeAddress()
  }
  protected getRewardAddresses(): Promise<string[]> {
    this.logP2PWalletMethod()
    return this.w.getRewardAddresses()
  }
  protected signTx(tx: string, partialSign: boolean): Promise<string> {
    this.logP2PWalletMethod()
    return this.w.signTx(tx, partialSign)
  }
  protected signData(addr: string, payload: string): Promise<Cip30DataSignature> {
    this.logP2PWalletMethod()
    return this.w.signData(addr, payload)
  }
  protected submitTx(tx: string): Promise<string> {
    this.logP2PWalletMethod()
    return this.w.submitTx(tx)
  }

  public static initP2PClient(handler: ConnectionStateChangeHandler, seed?: string) {
    const peerConnect = new SorbetPeerConnect(seed)
    Log.App.P2PConnect("Created New P2P Client", seed ? `with Seed ${seed}` : 'without Seed', peerConnect)

    const logMessage = (func: string, connectMessage: IConnectMessage) =>
      Log.App.P2PConnect(`${func} p2p connection state change hook called with message:`, connectMessage)

    /** Setup connection status listeners */
    peerConnect.setOnConnect((connectMessage: IConnectMessage) => {
      logMessage("OnConnect", connectMessage)
      handler(peerConnect, 'connected', connectMessage)
    });

    peerConnect.setOnDisconnect((connectMessage: IConnectMessage) => {
      logMessage("OnDisconnect", connectMessage)
      handler(peerConnect, 'disconnected', connectMessage)
    });

    peerConnect.setOnServerShutdown((connectMessage: IConnectMessage) => {
      logMessage("ServerShutdown", connectMessage)
      handler(peerConnect, 'disconnected', connectMessage)
    });

    peerConnect.setOnApiInject((connectMessage: IConnectMessage) => {
      logMessage("ApiInject", connectMessage)
    });
    return peerConnect
  }
}