const fs = require('fs')
const util = require('util')

const lstat = util.promisify(fs.lstat)
const readDir = util.promisify(fs.readdir)

const Table = require('cli-table3')
const yargs = require('yargs')

// 1 KiB = 1.024 bytes
const DEFAULT_MAX_CONTRACT_SIZE_IN_KIB = 24
const VALUE_BYTES = 1024;

/**
 * Outputs the size of a given smart contract
 * @param config - A truffle-config object.
 * Has attributes like `truffle_directory`, `working_directory`, etc.
 * @param done - A done callback, or a normal callback.
 */
module.exports = async (config, done) => {
  configureArgumentParsing()
  yargs.parse(process.argv.slice(3))

  const contractNames = yargs.argv.contracts
  const { checkMaxSize, ignoreMocks, sizeInBytes } = yargs.argv
 

  if (!isValidCheckMaxSize(checkMaxSize)) {
    done(`--checkMaxSize: invalid value ${checkMaxSize}`)
  }

  const table = new Table({
    head: ['Contract'.white.bold, {content:'Size'.white.bold,hAlign:'right'}],
    colWidths: [70, sizeInBytes ? 13 : 12]  
  })

  // array of objects of {file: path to file, name: name of the contract}
  const contracts = await getContracts(config, contractNames, ignoreMocks, done)
  let totalKib = 0;

  if (contracts.length == 0) return done(`There are no compiled contracts to calculate the size.`);    

  const contractPromises = contracts.map(async (contract) => {
    await checkFile(contract.file, done)

    const contractFile = require(contract.file)

    if (!('deployedBytecode' in contractFile)) {
      done(`Error: deployedBytecode not found in ${contract.file} (it is not a contract json file)`)
    }

    const kibCodeSize = computeByteCodeSizeInKiB(contractFile.deployedBytecode)
    totalKib += kibCodeSize;

    table.push([
      contract.name,
      sizeInBytes ? {content:formatByteCodeSize(convertToByte(kibCodeSize)),hAlign:'right'} : {content:formatKiBCodeSize(kibCodeSize),hAlign:'right'} 
    ])
  }) 

  await Promise.all(contractPromises)

  table.push([
    "Total".white.bold,
    sizeInBytes ?  {content:formatByteCodeSize(convertToByte(totalKib)).white.bold,hAlign:'right'} : {content:formatKiBCodeSize(totalKib).white.bold,hAlign:'right'}
  ])

  console.log(table.toString())

  if (checkMaxSize) {
    const maxSize = checkMaxSize === true ? DEFAULT_MAX_CONTRACT_SIZE_IN_KIB : checkMaxSize

    table.forEach(row => {
      if (Number.parseFloat(row[1]) > maxSize) {
        done(`Contract ${row[0]} is bigger than ${maxSize} KiB`)
      }
    })
  }

  done()

}

function configureArgumentParsing () {
  yargs.option('contracts', { describe: 'Only display certain contracts', type: 'array' })
  yargs.option('checkMaxSize', { describe: 'Returns an error exit code if a contract is bigger than the optional size in KiB (default: 24). Must be an integer value' })
  yargs.option('ignoreMocks', { describe: 'Ignores all contracts which names end with "Mock"', type: 'boolean' })
  yargs.option('sizeInBytes', { describe: 'Shows the size of the contracts in Bytes', type: 'boolean' })

  // disable version parameter
  yargs.version(false)

  // puts help parameter at the end of the parameter list
  yargs.help()
}

function isValidCheckMaxSize (checkMaxSize) {
  if (checkMaxSize === undefined) {
    return true
  }

  return checkMaxSize === true || !Number.isNaN(checkMaxSize)
}

function computeByteCodeSizeInKiB (byteCode) {
  // -2 to remove 0x from the beginning of the string
  // /2 because one byte consists of two hexadecimal values
  // /1024 to convert to size from byte to kibibytes
  return (byteCode.length - 2) / 2 / VALUE_BYTES
}

function convertToByte (valueKib) {
  return valueKib * VALUE_BYTES;
}

function formatKiBCodeSize (kibteCodeSize) {
  return `${kibteCodeSize.toFixed(2)} KiB`
}

function formatByteCodeSize (byteCodeSize) {
  return `${byteCodeSize} Bytes`
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

async function getContracts (config, contractNames, ignoreMocks, done) {
  const contractsBuildDirectory = config.contracts_build_directory

  if (contractNames === undefined || contractNames.length === 0) {
    contractNames = await getAllContractNames(contractsBuildDirectory, ignoreMocks, done)
  }

  return contractNames.map(contractName => {
    return {
      file: `${contractsBuildDirectory}/${contractName}.json`,
      name: contractName
    }
  })
}

async function getAllContractNames (contractsBuildDirectory, ignoreMocks, done) {
  let files

  try {
    files = await readDir(contractsBuildDirectory)
  } catch (error) {
    done(`Error while getting contracts from build directory: ${error.message}`)
  }

  const contractsFiles = files.filter(file => {
    if (!file.endsWith('.json')) {
      return false
    }

    if (ignoreMocks && file.endsWith('Mock.json')) {
      return false
    }

    return true
  })

  // -5 because that's the length of the string '.json'
  return contractsFiles.map(contractFile => contractFile.slice(0, -5))
}
