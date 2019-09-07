const fs = require('fs')
const util = require('util')

const lstat = util.promisify(fs.lstat)
const readDir = util.promisify(fs.readdir)

const Table = require('cli-table')

/**
 * Outputs the size of a given smart contract
 * @param config - A truffle-config object.
 * Has attributes like `truffle_directory`, `working_directory`, etc.
 * @param done - A done callback, or a normal callback.
 */
module.exports = async (config, done) => {
  const table = new Table({
    head: ['Contract'.white.bold, 'Size'.white.bold],
    colWidths: [70, 10]
  })

  // array of objects of {file: path to file, name: name of the contract}
  const contracts = await getContracts(config, done)

  const contractPromises = contracts.map(async (contract) => {
    await checkFile(contract.file, done)

    const contractFile = require(contract.file)

    if (!('deployedBytecode' in contractFile)) {
      done(`Error: deployedBytecode not found in ${contract.file} (it is not a contract json file)`)
    }

    const byteCodeSize = computeByteCodeSizeInKb(contractFile.deployedBytecode)

    table.push([
      contract.name,
      formatByteCodeSize(byteCodeSize)
    ])
  })

  await Promise.all(contractPromises)

  console.log(table.toString())

  done()
}

function computeByteCodeSizeInKb (byteCode) {
  // -2 to remove 0x from the beginning of the string
  // /2 because one byte consists of two hexadecimal values
  // /1024 to convert to size from byte to kilo byte
  return (byteCode.length - 2) / 2 / 1024
}

function formatByteCodeSize (byteCodeSize) {
  return `${byteCodeSize.toFixed(2)} kb`
}

async function checkFile (filePath, done) {
  let stat

  try {
    stat = await lstat(filePath)
  } catch (error) {
    done(`Error while checking file ${filePath}: ${error.message}`)
  }

  if (!stat.isFile()) {
    done(`Error: ${filePath} is not a valid file`)
  }
}

async function getContracts (config, done) {
  const contractsBuildDirectory = config.contracts_build_directory
  let contractNames = getContractNamesFromCommandArguments(config)

  if (contractNames.length === 0) {
    contractNames = await getAllContractNames(contractsBuildDirectory, done)
  }

  return contractNames.map(contractName => {
    return {
      file: `${contractsBuildDirectory}/${contractName}.json`,
      name: contractName
    }
  })
}

function getContractNamesFromCommandArguments (config) {
  // the first item is the command name, the following ones are the contract names
  return config._.slice(1)
}

async function getAllContractNames (contractsBuildDirectory, done) {
  let files

  try {
    files = await readDir(contractsBuildDirectory)
  } catch (error) {
    done(`Error while getting contracts from build directory: ${error.message}`)
  }

  const contractsFiles = files.filter(file => file.endsWith('.json'))

  // -5 because that's the length of the string '.json'
  return contractsFiles.map(contractFile => contractFile.slice(0, -5))
}
