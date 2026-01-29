# Sorbet

![build](https://github.com/SundaeSwap-finance/Sorbet/workflows/build/badge.svg)

The Cardano Developer's Wallet - A browser extension for testing and debugging dApp integrations.

## Features

### Wallet Modes
- **Impersonate** - Test dApps using any Cardano address without owning the keys
- **Wrap** - Extend an existing wallet (Eternl, Nami, Lace, etc.) with debugging capabilities
- **Override** - Replace the connected wallet with another for testing

### Developer Tools
- **Contacts** - Save and manage frequently used addresses with labels
- **P2P Connect (CIP-45)** - Connect to dApps on other devices via peer-to-peer
- **UTxO Builder** - Create custom responses for `getUtxos()`, `getBalance()`, and `getCollateral()`
- **Log Viewer** - Inspect CIP-30 traffic between dApps and wallets
- **ADA Handle Support** - Resolve `$handle` names to addresses

### Supported Wallets
Begin, Eternl, Nami, Typhon, Yoroi, Lace, Flint, Vespr

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) v1.0+
- Chrome, Brave, or Edge browser
- [Blockfrost API key](https://blockfrost.io/) (free tier available)

### Build & Install

```bash
# Install dependencies
bun install

# Build the extension
bun run build
```

### Load in Browser

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist` folder

### Configure

1. Click the Sorbet extension icon
2. Click the gear icon (Settings)
3. Enter your Blockfrost API keys (Mainnet and/or Preview)

## Development

```bash
# Watch mode with hot reload
bun run watch

# Format code
bun run style

# Production build
bun run build
```

## Usage

### Impersonate Mode
1. Select **Impersonate** mode
2. Paste any Cardano address or ADA handle (`$handle`)
3. The address will appear as a connected CIP-30 wallet to dApps

### Wrap Mode
1. Select **Wrap** mode
2. Choose a base wallet (must be installed)
3. Sorbet wraps the wallet, allowing you to inspect all CIP-30 calls

### P2P Connect
1. Go to the **Connect** tab
2. Click **Launch Connection Manager**
3. Paste the Peer ID from your dApp
4. Sorbet connects via CIP-45 peer-to-peer

## Hooks API

dApps can integrate programmatically:

```javascript
// Set the impersonated address
window.cardano.sorbet.setAddress("addr1...")

// Add to contacts
window.cardano.sorbet.addToAddressBook("addr1...")
```

## Tech Stack

- React 18 + TypeScript
- Material UI v5
- Webpack 5
- Chrome Extension Manifest V3

## License

MIT
