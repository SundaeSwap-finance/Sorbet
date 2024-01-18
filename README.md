# Sorbet

![build](https://github.com/SundaeSwap-finance/Sorbet/workflows/build/badge.svg)

The Cardano Developer's Wallet

## Roadmap
- [x] Impersonate an address, viewing the dApp (roughly) as that user would
- [x] Wrap a wallet, passing through functionality to an existing wallet
- [ ] Save common addresses in an address book
- [ ] Add the ability for sites to build Sorbet integrations
- [ ] CIP-45 capability
- [ ] Inspect traffic between a dApp and a wallet
- [ ] Return arbitrary data or errors to dApp requests, to test corner cases

## Installing

To install the extension, first build the the extension

```
$ yarn
$ yarn build
```

Then, from chrome or brave, click manage extensions:

![Manage Extensions](./docs/install-1.png)

Finally, enable developer mode, and click "Load Unpacked", navigating to the `dist` folder generated by yarn build.

![Load Extension](./docs/install-2.png)

To use the extension, first configure a blockfrost API key.

Click "Details" on the extension you loaded

![Details](./docs/configure-1.png)

and click "Extension Options"

![Options](./docs/configure-2.png)

from here, you can enter any configuration that the extension needs to operate.

## Use

Once configured, you can enter a wallet address to impersonate from the extension popup:

![Impersonate](./docs/use-1.png)

and it should appear as a CIP-30 wallet on the page:

![Sorbet](./docs/use-2.png)
