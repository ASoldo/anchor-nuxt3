<template>
  <div>
    <br />
    <NuxtLink id="about-link" to="/about">About</NuxtLink>
    <ClientOnly>
      <WalletMultiButton dark />
    </ClientOnly>
    <h1 class="text-3xl font-bold underline bg-red-500">Hello world!</h1>
    <button @click="sendSol">Send Sol</button>
    <h1 v-if="connected">
      {{ ballance_frontend }} SOL
      <span class="bg-blue-500 rounded-2xl p-1.5 mx-1 text-white">{{
      wallet?.adapter.publicKey
    }}</span>
    </h1>
    <h1>WebSocket messages</h1>
    <ul class="h-32 overflow-hidden overflow-y-auto border-black border p-2 m-2">
      <li v-for="(message, index) in messages" :key="index">
        {{ message.params.result.value.account.data }}
      </li>
    </ul>
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

const store = useCounterStore();

const PROGRAM_KEY = new web3.PublicKey(idl.metadata.address);
console.log("Program_key: ", PROGRAM_KEY);

const { wallet, connected, signTransaction, sendTransaction, publicKey } =
  useWallet();

const anchorWallet = useAnchorWallet();

const ws = ref();

const ballance_frontend = ref<Number>(0);
const messages =
  ref<Array<ProgramNotificationResponse>>(Array<ProgramNotificationResponse>());
const receivedData = ref<ProgramNotificationResponse | null>(null);

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
console.log(wallet.value?.adapter.publicKey);

watch(connected, async (newConnectedStatus, prevConnectedStatus) => {
  if (newConnectedStatus) {
    console.log("Wallet connected");
    await fetchBalance();
  } else {
    console.log("Wallet disconnected");
  }
});

const sendSol = () => {
  const transaction = new web3.Transaction();
  const recipientPubKey = new web3.PublicKey(
    "CBJffHoaQAiV5HuLwEkXgb7k4Px6Ys7YS8waQzCDUFHt",
  );

  const sendSolInstruction = web3.SystemProgram.transfer({
    fromPubkey: wallet.value?.adapter.publicKey as web3.PublicKey,
    toPubkey: recipientPubKey,
    lamports: web3.LAMPORTS_PER_SOL * 0.1,
  });

  const connection = new web3.Connection(
    web3.clusterApiUrl("devnet"),
    "confirmed",
  );

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
        "2wVNAZaVLTWXxoKxmW7DT8BDnopa9Pu8F7Xm1qgxBzWf",
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
        "FUrf5ptFqKWm61TjX5zq2Nmoqq6m77q5aKH7n8ro4uax",
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
        "FUrf5ptFqKWm61TjX5zq2Nmoqq6m77q5aKH7n8ro4uax",
      ).toBuffer(),
      Uint8Array.from([1]),
    ],
    program.programId,
  );

  const postPdaResponse = await program.account.postAccount.fetch(postPda);
  console.log("Post PDA Response", postPdaResponse);
});

onUnmounted(() => {
  if (ws.value && receivedData.value) {
    console.log("Unsubscribing and disconnecting WebSocket");
    const unsubscribeMessage = {
      jsonrpc: "2.0",
      id: 1,
      method: "programUnsubscribe",
      params: [receivedData?.value.params.subscription],
    };
    ws.value.send(JSON.stringify(unsubscribeMessage));
    ws.value.close();
  }
});
</script>
