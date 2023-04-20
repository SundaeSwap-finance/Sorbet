export type TPaginate = {
    page: number;
    limit: number;
  };

  export type TDataSignature = {
    signature: string;
    key: string;
  };

/**
 * Experimental API
 * Multiple experimental namespaces are used:
 *
 * under api (ex: api.experimental.myFunctionality).
 * under cardano.{walletName} (ex: window.cardano.{walletName}.experimental.myFunctionality)
 * The benefits of this are:
 *
 * Wallets can add non-standardized features while still following the CIP30 structure
 * dApp developers can use these functions explicitly knowing they are experimental (not stable or standardized)
 * New features can be added to CIP30 as experimental features and only moved to non-experimental once multiple wallets implement it
 * It provides a clear path to updating the CIP version number (when functions move from experimental -> stable)
 */
export type TExperimentalApi = { [key: string]: unknown };

export type TConnectedApi = {
  experimental?: TExperimentalApi;

  /**
   * Errors: APIError
   *
   * Returns the network id of the currently connected account. 0 is testnet and 1 is mainnet but other networks can possibly be returned by wallets. Those other network ID values are not governed by this document. This result will stay the same unless the connected account has changed.
   */
  getNetworkId(): Promise<number>;

  /**
   * Errors: APIError, PaginateError
   *
   * If amount is undefined, this shall return a list of all UTXOs (unspent transaction outputs) controlled by the wallet.
   * If amount is not undefined, this request shall be limited to just the UTXOs that are required to reach the combined ADA/multiasset value target specified in amount,
   * and if this cannot be attained, null shall be returned. The results can be further paginated by paginate if it is not undefined.
   * @param amount
   * @param paginate
   */
  getUtxos(
    amount?: string | undefined,
    paginate?: TPaginate | undefined
  ): Promise<string[] | null>;

  /**
   * Errors: APIError
   *
   * The function takes a required object with parameters. With a single required parameter for now: amount. (NOTE: some wallets may be ignoring the amount parameter, in which case it might be possible to call the function without it, but this behavior is not recommended!). Reasons why the amount parameter is required:
   *
   *  1. Dapps must be motivated to understand what they are doing with the collateral, in case they decide to handle it manually.
   *  2. Depending on the specific wallet implementation, requesting more collateral than necessarily might worsen the user experience with that dapp, requiring the wallet to make explicit wallet reorganisation when it is not necessary and can be avoided.
   *  3. If dapps don't understand how much collateral they actually need to make their transactions work - they are placing more user funds than necessary in risk.
   *
   *  So requiring the amount parameter would be a by-spec behavior for a wallet. Not requiring it is possible, but not specified, so dapps should not rely on that and the behavior is not recommended.
   *
   * This shall return a list of one or more UTXOs (unspent transaction outputs) controlled by the wallet that are required to reach AT LEAST the combined ADA value target specified in amount AND the best suitable to be used as collateral inputs for transactions with plutus script inputs (pure ADA-only utxos). If this cannot be attained, an error message with an explanation of the blocking problem shall be returned. NOTE: wallets are free to return utxos that add up to a greater total ADA value than requested in the amount parameter, but wallets must never return any result where utxos would sum up to a smaller total ADA value, instead in a case like that an error message must be returned.
   *
   * The main point is to allow the wallet to encapsulate all the logic required to handle, maintain, and create (possibly on-demand) the UTXOs suitable for collateral inputs. For example, whenever attempting to create a plutus-input transaction the dapp might encounter a case when the set of all user UTXOs don't have any pure entries at all, which are required for the collateral, in which case the dapp itself is forced to try and handle the creation of the suitable entries by itself. If a wallet implements this function it allows the dapp to not care whether the suitable utxos exist among all utxos, or whether they have been stored in a separate address chain (see #104), or whether they have to be created at the moment on-demand - the wallet guarantees that the dapp will receive enough utxos to cover the requested amount, or get an error in case it is technically impossible to get collateral in the wallet (e.g. user does not have enough ADA at all).
   *
   * The amount parameter is required, specified as a string (BigNumber) or a number, and the maximum allowed value must be agreed to be something like 5 ADA. Not limiting the maximum possible value might force the wallet to attempt to purify an unreasonable amount of ADA just because the dapp is doing something weird. Since by protocol the required collateral amount is always a percentage of the transaction fee, it seems that the 5 ADA limit should be enough for the foreseable future.
   *
   * @param amount
   */
  getCollateral(params: {
    amount: string;
  }): Promise<string[] | null>;

  /**
   * Errors: APIError
   *
   * Returns the total balance available of the wallet. This is the same as summing the results of api.getUtxos(), but it is both useful to dApps and likely already maintained by the implementing wallet in a more efficient manner so it has been included in the API as well.
   */
  getBalance(): Promise<string>;

  /**
   * Errors: APIError
   *
   * Returns a list of all used (included in some on-chain transaction) addresses controlled by the wallet. The results can be further paginated by paginate if it is not undefined.
   *
   * @param paginate
   */
  getUsedAddresses(paginate?: TPaginate): Promise<string[]>;

  /**
   * Errors: APIError
   *
   * Returns a list of unused addresses controlled by the wallet.
   *
   * @param paginate
   */
  getUnusedAddresses(paginate?: TPaginate): Promise<string[]>;

  /**
   * Errors: APIError
   *
   * Returns an address owned by the wallet that should be used as a change address to return leftover assets during transaction creation back to the connected wallet. This can be used as a generic receive address as well.
   */
  getChangeAddress(): Promise<string>;

  /**
   * Errors: APIError
   *
   * Returns the reward addresses owned by the wallet. This can return multiple addresses e.g. CIP-0018.
   */
  getRewardAddresses(): Promise<string[]>;

  /**
   * Errors: APIError, TxSignError
   *
   * Requests that a user sign the unsigned portions of the supplied transaction. The wallet should ask the user for permission, and if given, try to sign the supplied body and return a signed transaction. If partialSign is true, the wallet only tries to sign what it can. If partialSign is false and the wallet could not sign the entire transaction, TxSignError shall be returned with the ProofGeneration code. Likewise if the user declined in either case it shall return the UserDeclined code. Only the portions of the witness set that were signed as a result of this call are returned to encourage dApps to verify the contents returned by this endpoint while building the final transaction.
   *
   * @param tx
   * @param partialSign
   */
  signTx(
    tx: string,
    partialSign?: boolean
  ): Promise<string>;

  /**
   * Errors: APIError, DataSignError
   *
   * This endpoint utilizes the CIP-0008 signing spec for standardization/safety reasons. It allows the dApp to request the user to sign a payload conforming to said spec. The user's consent should be requested and the message to sign shown to the user. The payment key from addr will be used for base, enterprise and pointer addresses to determine the EdDSA25519 key used. The staking key will be used for reward addresses. This key will be used to sign the COSE_Sign1's Sig_structure with the following headers set:
   *
   * alg (1) - must be set to EdDSA (-8)
   *
   * kid (4) - Optional, if present must be set to the same value as in the COSE_key specified below. It is recommended to be set to the same value as in the "address" header.
   *
   * "address" - must be set to the raw binary bytes of the address as per the binary spec, without the CBOR binary wrapper tag
   *
   * The payload is not hashed and no external_aad is used.
   *
   * If the payment key for addr is not a P2Pk address then DataSignError will be returned with code AddressNotPK. ProofGeneration shall be returned if the wallet cannot generate a signature (i.e. the wallet does not own the requested payment private key), and UserDeclined will be returned if the user refuses the request. The return shall be a DataSignature with signature set to the hex-encoded CBOR bytes of the COSE_Sign1 object specified above and key shall be the hex-encoded CBOR bytes of a COSE_Key structure with the following headers set:
   *
   * kty (1) - must be set to OKP (1)
   *
   * kid (2) - Optional, if present must be set to the same value as in the COSE_Sign1 specified above.
   *
   * alg (3) - must be set to EdDSA (-8)
   *
   * crv (-1) - must be set to Ed25519 (6)
   *
   * x (-2) - must be set to the public key bytes of the key used to sign the Sig_structure
   *
   * @param addr
   * @param payload
   */
  signData(addr: string, payload: string): Promise<TDataSignature>;

  /**
   * Errors: APIError, TxSendError
   *
   * As wallets should already have this ability, we allow dApps to request that a transaction be sent through it. If the wallet accepts the transaction and tries to send it, it shall return the transaction id for the dApp to track. The wallet is free to return the TxSendError with code Refused if they do not wish to send it, or Failure if there was an error in sending it (e.g. preliminary checks failed on signatures).
   *
   * @param tx
   */
  submitTx(tx: string): Promise<string>;
};