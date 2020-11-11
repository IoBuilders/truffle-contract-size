# truffle-contract-size

[![npm](https://img.shields.io/npm/v/truffle-contract-size.svg)](https://www.npmjs.com/package/truffle-contract-size)

This [Truffle](https://www.trufflesuite.com/docs/truffle/overview) plugin displays the contract size of all or a selection of your smart contracts in kilobytes.

## Installation

1. Install the plugin with npm

```bash
npm install truffle-contract-size
```

2. Add the plugin to your `truffle.js` or `truffle-config.js` file
```js
    module.exports = {
      /* ... rest of truffle-config */

      plugins: [
        'truffle-contract-size'
      ]
    }
```

## Usage

The command can be executed without any arguments to display the size of **all** contracts in the projects.

```bash
truffle run contract-size
```

To show only certain contracts one or more contract names can be given as arguments to the contracts option:

```bash
truffle run contract-size --contracts ExampleContract1 ExampleContract2
```

### Check maximum contract sizes

The plugin can be used to check that the smart contracts aren't bigger than the allowed maximum contract size of the Ethereum Mainnet (24 KiB = 24576 bytes). For example this can be used, to make a CI/CD pipeline fail, if a contract is bigger than allowed.

```bash
truffle run contract-size --checkMaxSize
```

If another size limit than the default one should be checked, it can be given as argument to the option. For example to set the maximum to 48 KiB the following command can be used:

```bash
truffle run contract-size --checkMaxSize 48
```

If one or more of the contracts are bigger than the maximum size, an error message will de displayed, and the exit status will be 1.

### Ignore mocks

Mock contracts are used to improve the testing of smart contracts. As they are only used during testing and will not be deployed, it can be useful to ignore when calculating the contract sizes. When the option is used, all contract which names are ending with `Mock` will be ignored. This can especially be useful in combination with the `--checkMaxSize` option.

```bash
truffle run contract-size --ignoreMocks
```
