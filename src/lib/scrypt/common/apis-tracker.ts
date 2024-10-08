import { OpenMinterState, ProtocolState, ProtocolStateList } from '@/lib/scrypt/contracts/dist'
import { OpenMinterContract } from '@/lib/scrypt/common'
import { OpenMinterTokenInfo, TokenMetadata } from './metadata'
import { isOpenMinter } from './minterFinder'
import { getRawTransaction } from './apis'
import { getTokenContractP2TR, p2tr2Address, script2P2TR, toP2tr } from './utils'
import { byteString2Int } from 'scrypt-ts'
import { scaleConfig } from '@/lib/scrypt/token'
import { logerror } from './log'
import { btc } from './btc'
import { API_URL } from '@/lib/constants'

export type ContractJSON = {
	utxo: {
		txId: string
		outputIndex: number
		script: string
		satoshis: number
	}
	txoStateHashes: Array<string>
	state: any
}

export type BalanceJSON = {
	blockHeight: number
	balances: Array<{
		tokenId: string
		confirmed: string
	}>
}

export const getTokenMetadata = async function(id: string): Promise<TokenMetadata | null> {
	const url = `${API_URL}/api/tokens/${id}`
	return fetch(url)
		.then(res => res.json())
		.then((res: any) => {
			if (res.code === 0) {
				if (res.data === null) {
					return null
				}
				const token = res.data
				if (token.info.max) {
					// convert string to  bigint
					token.info.max = BigInt(token.info.max)
					token.info.premine = BigInt(token.info.premine)
					token.info.limit = BigInt(token.info.limit)
				}

				if (!token.tokenAddr) {
					const minterP2TR = toP2tr(token.minterAddr)
					const network = 'fractal-mainnet'
					token.tokenAddr = p2tr2Address(getTokenContractP2TR(minterP2TR).p2tr, network)
				}
				return token
			} else {
				throw new Error(res.msg)
			}
		})
		.catch(e => {
			logerror(`get token metadata failed!`, e)
			return null
		})
}

export const getTokenMinterCount = async function(id: string): Promise<number> {
	const url = `${API_URL}/api/minters/${id}/utxoCount`
	return fetch(url)
		.then(res => res.json())
		.then((res: any) => {
			if (res.code === 0) {
				return res.data
			} else {
				throw new Error(res.msg)
			}
		})
		.then(({ count }) => {
			return count
		})
		.catch(e => {
			logerror(`fetch token minter count failed!`, e)
			return 0
		})
}

const fetchOpenMinterState = async function(
	metadata: TokenMetadata,
	txId: string,
	vout: number
): Promise<OpenMinterState | null> {
	const minterP2TR = toP2tr(metadata.minterAddr)
	const tokenP2TR = toP2tr(metadata.tokenAddr)
	const info = metadata.info as OpenMinterTokenInfo
	const scaledInfo = scaleConfig(info)
	if (txId === metadata.revealTxid) {
		return {
			isPremined: false,
			remainingSupply: scaledInfo.max - scaledInfo.premine,
			tokenScript: tokenP2TR
		}
	}

	const txhex = await getRawTransaction(txId)
	if (txhex instanceof Error) {
		logerror(`get raw transaction ${txId} failed!`, txhex)
		return null
	}

	const tx = new btc.Transaction(txhex)

	const REMAININGSUPPLY_WITNESS_INDEX = 16

	for (let i = 0; i < tx.inputs.length; i++) {
		const witnesses = tx.inputs[i].getWitnesses()

		if (witnesses.length > 2) {
			const lockingScriptBuffer = witnesses[witnesses.length - 2]
			const { p2tr } = script2P2TR(lockingScriptBuffer)
			if (p2tr === minterP2TR) {
				const preState: OpenMinterState = {
					tokenScript: witnesses[REMAININGSUPPLY_WITNESS_INDEX - 2].toString('hex'),
					isPremined:
						witnesses[REMAININGSUPPLY_WITNESS_INDEX - 1].toString('hex') == '01' ? true : false,
					remainingSupply: byteString2Int(witnesses[6 + vout].toString('hex'))
				}

				return preState
			}
		}
	}

	return null
}

export const getTokenMinter = async function(
	metadata: TokenMetadata,
	offset: number = 0
): Promise<OpenMinterContract | null> {
	const url = `${API_URL}/api/minters/${metadata.tokenId}/utxos?limit=32&offset=${offset}`
	return fetch(url)
		.then(res => res.json())
		.then((res: any) => {
			if (res.code === 0) {
				return res.data
			} else {
				throw new Error(res.msg)
			}
		})
		.then(({ utxos: contracts }) => {
			// Randomly select a contract from the available contracts
			const randomIndex = Math.floor(Math.random() * contracts.length)
			const selectedContract = contracts[randomIndex]

			// If no contracts are available, return null
			if (!selectedContract) {
				throw new Error('No minters available')
			}

			// Prepare the contracts array with only the selected contract
			contracts = [selectedContract]

			// Add a comment explaining the random selection
			// This random selection helps distribute the load across different minter UTXOs
			// and can prevent potential bottlenecks or overuse of a single UTXO

			if (isOpenMinter(metadata.info.minterMd5)) {
				return Promise.all(
					contracts.map(async (c: any) => {
						const protocolState = ProtocolState.fromStateHashList(
							c.txoStateHashes as ProtocolStateList
						)

						const data = await fetchOpenMinterState(metadata, c.utxo.txId, c.utxo.outputIndex)

						if (data === null) {
							throw new Error(
								`fetch open minter state failed, minter: ${metadata.minterAddr}, txId: ${c.utxo.txId}`
							)
						}

						if (typeof c.utxo.satoshis === 'string') {
							c.utxo.satoshis = parseInt(c.utxo.satoshis)
						}

						return {
							utxo: c.utxo,
							state: {
								protocolState,
								data
							}
						} as OpenMinterContract
					})
				)
			} else {
				throw new Error('Unkown minter!')
			}
		})
		.then(minters => {
			return minters[0] || null
		})
		.catch(e => {
			logerror(`fetch minters failed, minter: ${metadata.minterAddr}`, e)
			return null
		})
}
