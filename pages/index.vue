<template>
  <div>
    <br />
    <NuxtLink id="about-link" to="/about">About</NuxtLink>
    <ClientOnly>
      <WalletMultiButton dark />
      <div v-if="connected">
        <button class="bg-green-500 hover:bg-green-300 rounded-2xl p-2 m-1 text-black" @click="crateUserAccount">
          Crete User Account
        </button>
        <button class="bg-yellow-500 hover:bg-yellow-300 rounded-2xl p-2 m-1 text-black" @click="createPostAccount">
          Crete Post Account
        </button>
      </div>
    </ClientOnly>
    <h1 class="text-3xl font-bold underline bg-red-500">Hello world!</h1>
    <div class="flex flex-row gap-1">
      <input class="w-fit outline-black outline rounded-2xl p-2" v-model="ammountLamports" type="number"
        placeholder="Ammount: Nubmer" />
      <input class="w-fit outline-black outline rounded-2xl p-2" v-model="toAddress" type="text"
        placeholder="To: Address" />
      <button class="bg-cyan-500 hover:bg-cyan-300 rounded-2xl p-2 m-1 text-black" @click="sendSol">
        Send SOL
      </button>
    </div>
    <h1 class="pt-2" v-if="connected">
      {{ ballance_frontend }} SOL
      <span class="bg-blue-500 rounded-2xl p-1.5 mx-1 text-white">{{
        wallet?.adapter.publicKey
      }}</span>
    </h1>
    <div class="h-32 overflow-hidden overflow-y-auto border-black border p-2 m-2">
      <h1>WebSocket messages</h1>
      <ul v-if="messages.length > 0">
        <li v-for="(message, index) in messages" :key="index">
          {{ message.params.result.value.account.data }}
        </li>
      </ul>
    </div>
    <div v-for="(post, key) in allPosts" :key="key">
      <div class="bg-gray-200 p-2 m-2">
        <div>{{ post.account.title }}</div>
        <div>{{ post.account.content }}</div>
      </div>
    </div>

    <div v-for="(item, key) in itemsUnpacked" :key="key" class="w-24 h-24">
      <img :src="item" alt="item.name" />
      <h1>{{ item.uri }}</h1>
    </div>
    <h1>Items total: {{ itemsAvailable }}</h1>
    <h1>Items redeemed: {{ itemsRedeemed }}</h1>
    <h1>Symbol: {{ symbol }}</h1>
    <button class="bg-blue-500 p-2" @click="mint">Mint</button>
    <button class="bg-red-500 p-2" @click="getNftsFromWallet">Get NFT's</button>
    <button class="bg-green-500 p-2" @click="getAllTokens">
      Get all Tokens
    </button>
    <button class="bg-pink-500 p-2" @click="updateMetadata">
      Update Metadata
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";

import { useCounterStore } from "@/stores/counter";
import { WalletMultiButton, useWallet } from "solana-wallets-vue";
import { useAnchorWallet } from "solana-wallets-vue";
import idl from "@/public/idl.json";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine } from "@metaplex-foundation/mpl-candy-machine";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
  createMetadataAccountV3,
  fetchAllDigitalAssetByOwner,
  type CreateMetadataAccountV3InstructionAccounts,
  type CreateMetadataAccountV3InstructionArgs,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
  AccountLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import {
  publicKey as metaplexPublicKey,
  transactionBuilder,
  generateSigner,
  some,
} from "@metaplex-foundation/umi";
import {
  fetchCandyMachine,
  fetchCandyGuard,
  mintV2,
  mintFromCandyMachineV2,
} from "@metaplex-foundation/mpl-candy-machine";
import {
  setComputeUnitLimit,
  createMintWithAssociatedToken,
} from "@metaplex-foundation/mpl-toolbox";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";

const toAddress = ref<string>("");
const ammountLamports = ref<number>(0);

const allPosts = ref<Array<AllPosts>>();

const store = useCounterStore();

const PROGRAM_KEY = new web3.PublicKey(idl.metadata.address);
const CANDY_MACHINE_ID = new web3.PublicKey(
  "HtnP5Sv4cXi9VER1W2rw6CGagdnxmGVxnoPgTwMnXqhn",
);
console.log("Program_key: ", PROGRAM_KEY);

const { wallet, connected, signTransaction, sendTransaction, publicKey } =
  useWallet();

const anchorWallet = useAnchorWallet();

const ws = ref();

const ballance_frontend = ref<Number>(0);
const messages =
  ref<Array<ProgramNotificationResponse>>(Array<ProgramNotificationResponse>());
const receivedData = ref<ProgramNotificationResponse | null>(null);

// const candyMachinePublicKey = metaplexPublicKey(
//   wallet.value?.adapter.publicKey as web3.PublicKey,
// );
// const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
// const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);

const items = ref<Array<NftType>>([]) as any;
const itemsUnpacked = ref();
const itemsAvailable = ref(0);
const symbol = ref("");
const itemsRedeemed = ref(0);

type Nft = {
  index: number;
  minted: boolean;
  name: string;
  uri: string;
};
type NftType = {
  items: Array<Nft>;
};

type AllPosts = {
  account: {
    title: string;
    content: string;
  };
};
type ProgramNotificationResponse = {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      context: {
        slot: number;
      };
      value: {
        pubkey: string;
        account: {
          lamports: number;
          data: [string, string];
          executable: boolean;
          owner: string;
          rentEpoch: number;
          space: number;
        };
      };
    };
    subscription: number;
  };
};

type AccountNotification = {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      context: {
        slot: number;
      };
      value: {
        lamports: number;
        data: {
          program: string;
          parsed: {
            info: Array<{
              blockhash: string;
              feeCalculator: {
                lamportsPerSignature: string;
              };
            }>;
            type: string;
          };
          space: number;
          executable: boolean;
        };
        owner: string;
        rentEpoch: number;
        space: number;
      };
    };
    subscription: number;
  };
};

console.log(web3.clusterApiUrl());
console.log(web3.LAMPORTS_PER_SOL);
console.log(web3.SystemProgram.programId);
console.log(web3.SystemProgram.transfer.name);

watch(connected, async (newConnectedStatus, prevConnectedStatus) => {
  if (newConnectedStatus) {
    console.log("Wallet connected");
    await fetchBalance();
  } else {
    console.log("Wallet disconnected");
  }
});

watch(anchorWallet, async (newConnectedStatus, prevConnectedStatus) => {
  if (newConnectedStatus) {
    console.log("Anchor Wallet connected");
    await fetchBalance();
  } else {
    console.log("Anchor Wallet disconnected");
  }
});

const sendSol = () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );
  const transaction = new web3.Transaction();
  const recipientPubKey = new web3.PublicKey(toAddress.value);

  const sendSolInstruction = web3.SystemProgram.transfer({
    fromPubkey: wallet.value?.adapter.publicKey as web3.PublicKey,
    toPubkey: recipientPubKey,
    lamports: web3.LAMPORTS_PER_SOL * ammountLamports.value,
  });

  transaction.add(sendSolInstruction);

  sendTransaction(transaction, connection).then((sig) => {
    console.log(sig);
  });
};

const connectWebSocket = () => {
  ws.value = new WebSocket("wss://api.devnet.solana.com/");

  ws.value.onopen = () => {
    console.log("WebSocket connected");
    const subscribeMessage = {
      jsonrpc: "2.0",
      id: 1,
      method: "programSubscribe",
      params: [
        "5zhj7vyzuqzMoSf2NSASi1CkyshgqQHtTfNbKc5yPN1d",
        {
          encoding: "jsonParsed",
          commitment: "finalized",
        },
      ],
    };
    ws.value.send(JSON.stringify(subscribeMessage));
  };

  ws.value.onmessage = (event: any) => {
    const parsedData: ProgramNotificationResponse = JSON.parse(event.data);
    receivedData.value = parsedData;
    if (receivedData.value.method === "programNotification") {
      console.log("Messages: ", messages.value);
      messages.value.push(receivedData.value as never);
    }
  };

  ws.value.onerror = (error: any) => {
    console.error("WebSocket error: ", error);
  };

  ws.value.onclose = () => {
    console.log("WebSocket disconnected");
  };
};

const fetchBalance = async () => {
  if (!wallet.value?.adapter.connected && !wallet.value?.adapter.publicKey) {
    console.log("Wallet not connected");
    ballance_frontend.value = 0;
    return;
  }
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const balance = await connection.getBalance(
    wallet.value?.adapter.publicKey as web3.PublicKey,
  );
  ballance_frontend.value = balance / web3.LAMPORTS_PER_SOL;
};

const crateUserAccount = async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const provider = new anchor.AnchorProvider(
    connection,
    wallet.value as any,
    anchor.AnchorProvider.defaultOptions(),
  );

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_KEY, provider);

  console.log("Program: Crate User Account", program);

  const [create_user_data] = findProgramAddressSync(
    [
      utf8.encode("user"),
      new web3.PublicKey(
        wallet.value?.adapter.publicKey as web3.PublicKey,
      ).toBuffer(),
    ],
    program.programId,
  );
  console.log("Create user data", create_user_data);

  const prog = await program.methods
    .initUser("Marac", "Avatar")
    .accounts({
      userAccount: create_user_data,
      authority: anchorWallet.value?.publicKey as web3.PublicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();

  await sendTransaction(prog, connection);
};

const createPostAccount = async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const provider = new anchor.AnchorProvider(
    connection,
    anchorWallet as any,
    anchor.AnchorProvider.defaultOptions(),
  );

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_KEY, provider);

  console.log("Program: Crate Post Account", program);
  const [our_data] = findProgramAddressSync(
    [
      utf8.encode("user"),
      new web3.PublicKey(
        wallet.value?.adapter.publicKey as web3.PublicKey,
      ).toBuffer(),
    ],
    program.programId,
  );
  const [create_post_data] = findProgramAddressSync(
    [
      utf8.encode("post"),
      new web3.PublicKey(
        wallet.value?.adapter.publicKey as web3.PublicKey,
      ).toBuffer(),
      Uint8Array.from([0]),
    ],
    program.programId,
  );
  console.log("Create post data", create_post_data);

  const prog = await program.methods
    .createPost("Ovo je moj post", "Ovo je moj content")
    .accounts({
      postAccount: create_post_data,
      userAccount: our_data,
      authority: wallet.value?.adapter.publicKey as web3.PublicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();

  const post = await sendTransaction(prog, connection);

  console.log("Post: " + post);

  const all = await program.account.postAccount.all();
  console.log("Response", all);
  allPosts.value = all as never;
};

const getPosts = async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const provider = new anchor.AnchorProvider(
    connection,
    anchorWallet as any,
    anchor.AnchorProvider.defaultOptions(),
  );

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_KEY, provider);

  console.log("Program: Crate Post Account", program);
  const [our_data] = findProgramAddressSync(
    [
      utf8.encode("user"),
      new web3.PublicKey(
        wallet.value?.adapter.publicKey as web3.PublicKey,
      ).toBuffer(),
    ],
    program.programId,
  );
  const [create_post_data] = findProgramAddressSync(
    [
      utf8.encode("post"),
      new web3.PublicKey(
        wallet.value?.adapter.publicKey as web3.PublicKey,
      ).toBuffer(),
      Uint8Array.from([0]),
    ],
    program.programId,
  );
  console.log("Create post data", create_post_data);

  const prog = await program.methods
    .createPost("Ovo je moj post", "Ovo je moj content")
    .accounts({
      postAccount: create_post_data,
      userAccount: our_data,
      authority: wallet.value?.adapter.publicKey as web3.PublicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();

  await sendTransaction(prog, connection);
};

onMounted(async () => {
  connectWebSocket();

  setTimeout(async () => {
    await fetchBalance();
  }, 10);

  // nextTick(async () => {
  //   await fetchBalance()
  // });
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const provider = new anchor.AnchorProvider(
    connection,
    anchorWallet as any,
    anchor.AnchorProvider.defaultOptions(),
  );

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_KEY, provider);

  console.log("Program: ", program);

  const [our_data] = findProgramAddressSync(
    [
      utf8.encode("user"),
      new web3.PublicKey(
        "8Sfdm2sWFHsEfVfuU1XP6smdzUTpbsDpiAQU4xHjLaJa",
      ).toBuffer(),
    ],
    program.programId,
  );

  console.log("Our data", our_data);
  const response = await program.account.userAccount.fetch(our_data);
  console.log("Response", response);

  const [postPda] = findProgramAddressSync(
    [
      utf8.encode("post"),
      new web3.PublicKey(
        "8Sfdm2sWFHsEfVfuU1XP6smdzUTpbsDpiAQU4xHjLaJa",
      ).toBuffer(),
      Uint8Array.from([1]),
    ],
    program.programId,
  );

  const postPdaResponse = await program.account.postAccount.fetch(postPda);
  console.log("Post PDA Response", postPdaResponse);

  const all = await program.account.postAccount.all();
  console.log("Response", all);
  allPosts.value = all as never;

  const umi = createUmi("https://api.devnet.solana.com/").use(
    mplCandyMachine(),
  );
  console.log("Umi: ", umi);
  const candyMachinePublicKey = metaplexPublicKey(CANDY_MACHINE_ID);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  items.value = candyMachine.items as never;
  itemsAvailable.value = candyMachine.data.itemsAvailable as never;
  symbol.value = candyMachine.data.symbol;
  itemsRedeemed.value = candyMachine.itemsRedeemed as never;

  fetchNFTData();
  console.log("Candy Machine: ", candyMachine);
  console.log("Candy Guard: ", candyGuard);
});

const mint = async () => {
  const umi = createUmi("https://api.devnet.solana.com/").use(
    mplCandyMachine(),
  );
  umi.use(walletAdapterIdentity(wallet.value?.adapter as any));
  console.log("Umi: ", umi);

  const candyMachinePublicKey = metaplexPublicKey(CANDY_MACHINE_ID);
  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);

  const nftMint = generateSigner(umi);
  const transaction = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine: candyMachine.publicKey,
        candyGuard: candyGuard.publicKey,
        nftMint,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: candyMachine.authority,
        tokenStandard: candyMachine.tokenStandard,
        mintArgs: {
          solPayment: some({
            destination: metaplexPublicKey(
              wallet.value?.adapter.publicKey as web3.PublicKey,
            ),
          }),
        },
      }),
    );
  const { signature } = await transaction.sendAndConfirm(umi, {
    confirm: {
      commitment: "confirmed",
    },
  });
  const txid = bs58.encode(signature);
  console.log("success", `Mint successful! ${txid}`);

  // const nftMint = generateSigner(umi);
  // const nftOwner = generateSigner(umi).publicKey;
  //
  // console.log(nftMint);
  // await transactionBuilder()
  //   .add(setComputeUnitLimit(umi, { units: 800_000 }))
  //   .add(
  //     mintFromCandyMachineV2(umi, {
  //       candyMachine: candyMachine.publicKey,
  //       nftMint: nftMint,
  //       collectionMint: candyGuard.publicKey,
  //       collectionUpdateAuthority: candyMachine.publicKey,
  //       nftOwner: nftOwner,
  //       mintAuthority: umi.identity,
  //     }),
  //   )
  //   .sendAndConfirm(umi);
  // console.log("Candy Machine: ", candyMachine);
  // console.log("Candy Guard: ", candyGuard);
};

const fetchNFTData = async () => {
  const urls = await Promise.all(
    items.value.map(async (item: any) => {
      const response = await fetch(item.uri);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.image; // Assuming each JSON structure contains an 'image' field at the root
    }),
  );
  itemsUnpacked.value = urls;
};

const getNftsFromWallet = async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const umi = createUmi("https://api.devnet.solana.com/").use(
    mplCandyMachine(),
  );

  const assets = await fetchAllDigitalAssetByOwner(
    umi,
    wallet.value?.adapter.publicKey as any,
  );
  console.log(assets);
};

const getAllTokens = async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

  const tokenAccounts = await connection.getTokenAccountsByOwner(
    new web3.PublicKey(wallet.value?.adapter.publicKey as web3.PublicKey),
    {
      programId: TOKEN_PROGRAM_ID,
    },
  );

  console.log("Token                                         Balance");
  console.log("------------------------------------------------------------");
  console.log(tokenAccounts.value);
  tokenAccounts.value.forEach((tokenAccount) => {
    const accountData = AccountLayout.decode(tokenAccount.account.data);
    console.log(
      `${new web3.PublicKey(accountData.mint)}   ${accountData.amount}`,
    );
  });
};

const updateMetadata = async () => {
  const umi = createUmi("https://api.devnet.solana.com/").use(
    mplCandyMachine(),
  );
  umi.use(walletAdapterIdentity(wallet.value?.adapter as any));
  const signer = generateSigner(umi);
  const mint = new web3.PublicKey(
    "HSWkjsJ5N973g8TYC7FXDZkksJgpKE7YEudgB5hqonuW",
  );
  // const candyMachinePublicKey = metaplexPublicKey(CANDY_MACHINE_ID);
  //  const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
  //  const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
  const accounts: CreateMetadataAccountV3InstructionAccounts = {
    mint: fromWeb3JsPublicKey(mint),
    mintAuthority: signer,
  };
  const data: CreateMetadataAccountV3InstructionArgs = {
    isMutable: true,
    collectionDetails: null,
    data: {
      name: "Rootster",
      symbol: "ROOT",
      uri: "https://bafkreic3gsvl5rdzvj5dwyiowkpy6cagfo3tgkiknkgct7juzzyuvzdhum.ipfs.nftstorage.link/",
      sellerFeeBasisPoints: 500,
      collection: null,
      uses: null,
      creators: null,
    },
  };

  const txid = createMetadataAccountV3(umi, {
    ...accounts,
    ...data,
  }).sendAndConfirm(umi);
  console.log("TXID: ", txid);
};

onUnmounted(() => {
  // if (ws.value && receivedData.value) {
  //   console.log("Unsubscribing and disconnecting WebSocket");
  //   const unsubscribeMessage = {
  //     jsonrpc: "2.0",
  //     id: 1,
  //     method: "programUnsubscribe",
  //     params: [receivedData?.value.params.subscription],
  //   };
  //   ws.value.send(JSON.stringify(unsubscribeMessage));
  //   ws.value.close();
  // }
});
</script>
