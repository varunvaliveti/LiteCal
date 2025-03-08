import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Flare Network RPC endpoints
const FLARE_MAINNET_RPC = 'https://flare-api.flare.network/ext/C/rpc';
const FLARE_SONGBIRD_RPC = 'https://songbird-api.flare.network/ext/C/rpc';
const FLARE_COSTON_RPC = 'https://coston-api.flare.network/ext/C/rpc';

// Contract ABIs
const EVENT_CONTRACT_ABI = [
  // Example ABI for a smart contract that handles calendar events
  'function createEvent(string title, uint256 startTime, uint256 endTime, string description)',
  'function getEvent(uint256 eventId) view returns (string title, uint256 startTime, uint256 endTime, string description, address creator)',
  'function getAllEvents() view returns (uint256[])',
  'event EventCreated(uint256 indexed eventId, string title, address indexed creator)',
];

class FlareNetworkService {
  private provider: ethers.providers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private eventContract: ethers.Contract | null = null;
  private contractAddress: string = '';
  private networkType: 'mainnet' | 'songbird' | 'coston' = 'songbird'; // Default to testnet

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      await this.setupProvider();
      await this.loadWallet();
      this.setupEventContract();
    } catch (error) {
      console.error('Failed to initialize Flare Network service:', error);
    }
  }

  private async setupProvider() {
    // Get the stored network type or use default
    const storedNetworkType = await AsyncStorage.getItem('flare_network_type');
    if (storedNetworkType) {
      this.networkType = storedNetworkType as 'mainnet' | 'songbird' | 'coston';
    }

    // Set the appropriate RPC URL based on network type
    let rpcUrl = FLARE_SONGBIRD_RPC;
    if (this.networkType === 'mainnet') {
      rpcUrl = FLARE_MAINNET_RPC;
    } else if (this.networkType === 'coston') {
      rpcUrl = FLARE_COSTON_RPC;
    }

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  private async loadWallet() {
    // Load the private key from secure storage
    const privateKey = await AsyncStorage.getItem('flare_private_key');
    if (privateKey && this.provider) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      console.log('Wallet loaded successfully');
    }
  }

  private setupEventContract() {
    if (!this.wallet) return;

    // Get contract address based on network
    if (this.networkType === 'mainnet') {
      this.contractAddress = '0x123...'; // Replace with actual mainnet contract address
    } else if (this.networkType === 'songbird') {
      this.contractAddress = '0x456...'; // Replace with actual songbird contract address
    } else {
      this.contractAddress = '0x789...'; // Replace with actual coston contract address
    }

    this.eventContract = new ethers.Contract(
      this.contractAddress,
      EVENT_CONTRACT_ABI,
      this.wallet
    );
  }

  public async createWallet(): Promise<string> {
    const wallet = ethers.Wallet.createRandom();
    await AsyncStorage.setItem('flare_private_key', wallet.privateKey);
    
    // Fix for the "Argument of type 'JsonRpcProvider | null' is not assignable" error
    if (this.provider) {
      this.wallet = wallet.connect(this.provider);
      this.setupEventContract();
      return wallet.address;
    }
    
    throw new Error('Provider not initialized');
  }

  public async importWallet(privateKey: string): Promise<string> {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }
      
      const wallet = new ethers.Wallet(privateKey, this.provider);
      await AsyncStorage.setItem('flare_private_key', privateKey);
      this.wallet = wallet;
      this.setupEventContract();
      return wallet.address;
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw new Error('Invalid private key');
    }
  }

  public async getWalletAddress(): Promise<string | null> {
    if (this.wallet) {
      return this.wallet.address;
    }
    return null;
  }

  public async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.utils.formatEther(balance);
  }

  public async createCalendarEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    description: string
  ): Promise<string> {
    if (!this.eventContract || !this.wallet) {
      throw new Error('Contract or wallet not initialized');
    }

    try {
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);
      const endTimeUnix = Math.floor(endTime.getTime() / 1000);

      const tx = await this.eventContract.createEvent(
        title,
        startTimeUnix,
        endTimeUnix,
        description
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get the event ID from the emitted event
      // Fix for "Parameter 'e' implicitly has an 'any' type" error
      const event = receipt.events?.find((e: any) => e.event === 'EventCreated');
      const eventId = event?.args?.eventId.toString();
      
      return eventId || 'Event created';
    } catch (error) {
      console.error('Error creating calendar event on Flare Network:', error);
      throw error;
    }
  }

  public async getCalendarEvent(eventId: string): Promise<any> {
    if (!this.eventContract) {
      throw new Error('Contract not initialized');
    }

    try {
      const event = await this.eventContract.getEvent(eventId);
      return {
        title: event.title,
        startTime: new Date(event.startTime.toNumber() * 1000),
        endTime: new Date(event.endTime.toNumber() * 1000),
        description: event.description,
        creator: event.creator
      };
    } catch (error) {
      console.error('Error fetching calendar event from Flare Network:', error);
      throw error;
    }
  }

  public async switchNetwork(networkType: 'mainnet' | 'songbird' | 'coston') {
    this.networkType = networkType;
    await AsyncStorage.setItem('flare_network_type', networkType);
    await this.initialize();
  }

  public getNetworkType(): string {
    return this.networkType;
  }
}

// Export as singleton
export default new FlareNetworkService(); 