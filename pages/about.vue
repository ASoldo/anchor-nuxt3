<template>
  <div>about page</div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine } from "@metaplex-foundation/mpl-candy-machine";

onMounted(() => {
  console.log("mounted");
  const umi = createUmi("https://api.devnet.solana.com/").use(
    mplCandyMachine(),
  );
  console.log("Umi: ", umi);
});

// const candyMachinePublicKey = metaplexPublicKey(
//   wallet.value?.adapter.publicKey as web3.PublicKey,
// );
// const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey);
// const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority);
</script>
