const fs = require('fs')
const util = require('util')
const lodash = require('lodash')

const lstat = util.promisify(fs.lstat)
const readDir = util.promisify(fs.readdir)

const Table = require('cli-table')
const yargs = require('yargs')

// 1 KiB = 1.024 bytes
const DEFAULT_MAX_CONTRACT_SIZE_IN_KIB = 24

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
  const sortOptions = yargs.argv.sort
  const { checkMaxSize, ignoreMocks, disambiguatePaths } = yargs.argv

  if (!isValidCheckMaxSize(checkMaxSize)) {
    done(`--checkMaxSize: invalid value ${checkMaxSize}`)
  }

  let tableData = []

  // array of objects of {file: path to file, name: name of the contract}
  const contracts = await getContracts(config, contractNames, ignoreMocks, done)

  const contractPromises = contracts.map(async (contract) => {
    await checkFile(contract.file, done)

    const contractFile = require(contract.file)

    if (!('deployedBytecode' in contractFile)) {
      done(`Error: deployedBytecode not found in ${contract.file} (it is not a contract json file)`)
    }

    const byteCodeSize = computeByteCodeSizeInKiB(contractFile.deployedBytecode)

    tableData.push({
      name: disambiguatePaths ? contract.relativeName : contract.name,
      size: byteCodeSize,
      formatSize: formatByteCodeSize(byteCodeSize)
    })
  })

  await Promise.all(contractPromises)

  // Sort tableData
  if (sortOptions && sortOptions !== []) {
    tableData = orderTable({ sortOptions, tableData, done })
  }

  const table = drawTable(tableData)

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

function drawTable (data) {
  const table = new Table({
    head: ['Contract'.white.bold, 'Size'.white.bold],
    colWidths: [70, 10]
  })

  data.forEach(row => {
    const { name, formatSize } = row
    table.push([
      name,
      formatSize
    ])
  })

  return table
}

function orderTable ({ sortOptions, tableData, done }) {
  const type = sortOptions[0]
  const order = sortOptions[1]

  if (!type && !order) {
    done('Warning: sort default by name and asc.')
    tableData = lodash.orderBy(tableData, 'name', 'asc') // Default order
    return tableData
  }

  if (type !== 'name' && type !== 'size' && (order === 'asc' || order === 'desc')) {
    done('Warning: invalid value sort (valid values name or size).')
    tableData = lodash.orderBy(tableData, 'name', order)
    return tableData
  }

  if (order !== 'asc' && order !== 'desc' && (type !== 'name' || type !== 'size')) {
    done('Warning: invalid value order (valid values asc or desc).')
    tableData = lodash.orderBy(tableData, type, 'asc')
    return tableData
  }

  tableData = lodash.orderBy(tableData, type, order)
  return tableData
}

function configureArgumentParsing () {
  yargs.option('contracts', { describe: 'Only display certain contracts', type: 'array' })
  yargs.option('checkMaxSize', { describe: 'Returns an error exit code if a contract is bigger than the optional size in KiB (default: 24). Must be an integer value' })
  yargs.option('ignoreMocks', { describe: 'Ignores all contracts which names end with "Mock"', type: 'boolean' })
  yargs.option('sort', { describe: 'Sort results table by name or size and order asc or desc (default by name and asc). Size options: name or size. Order options: asc or desc', type: 'array' })
  yargs.option('disambiguatePaths', { describe: 'Display the full path of contracts in table', type: 'boolean' })

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
  return (byteCode.length - 2) / 2 / 1024
}

function formatByteCodeSize (byteCodeSize) {
  return `${byteCodeSize.toFixed(2)} KiB`
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
  const {
    contracts_build_directory: contractsBuildDirectory,
    working_directory: workingDirectory,
    contracts_directory: contractsDirectory
  } = config

  if (contractNames === undefined || contractNames.length === 0) {
    contractNames = await getAllContractNames(contractsBuildDirectory, ignoreMocks, done)
  }

  return contractNames.map(contractName => {
    return {
      file: `${contractsBuildDirectory}/${contractName}.json`,
      name: contractName,
      relativeName: `${contractsDirectory.split(workingDirectory)[1]}/${contractName}.sol`
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
