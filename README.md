# truffle-contract-size

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

To show only certain contracts one or more contract names can be given as arguments

```bash
truffle run contract-size ExampleContract1 ExampleContract2
```
