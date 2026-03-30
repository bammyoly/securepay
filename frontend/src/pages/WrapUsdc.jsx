import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useChainGuard } from "../hooks/useChainGuard";
import { getReadProvider, getEventsProvider, getWriteSigner } from "../utils/providers";

import cUSDCData from "../contracts/cUSDC.json";

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const CUSDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function wrap(uint256 amount) external",
  "function unwrap(uint256 amount) external",
  "function usdc() view returns (address)",
];

const ARBISCAN = "https://sepolia.arbiscan.io";

const getGasOverrides = async () => {
  const provider = getReadProvider(421614);
  const feeData  = await provider.getFeeData();
  const base     = feeData.gasPrice ?? feeData.maxFeePerGas ?? 20000000n;
  return {
    maxFeePerGas:         base * 130n / 100n,
    maxPriorityFeePerGas: 1500000n,
  };
};

const WrapUsdc = () => {
  const [activeTab,    setActiveTab]    = useState("wrap");
  const [amount,       setAmount]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [status,       setStatus]       = useState("");
  const [usdcBalance,  setUsdcBalance]  = useState("0.00");  // Circle USDC
  const [cusdcBalance, setCusdcBalance] = useState("0.00");  // cUSDC (plain ERC20)
  const [lastTxHash,   setLastTxHash]   = useState(null);

  const { chainId, onArb } = useChainGuard();
  const isWrap = activeTab === "wrap";

  // -------------------------------------------------------------------------
  // Fetch balances — both are plain ERC20, no FHE needed
  // -------------------------------------------------------------------------
  const fetchBalances = useCallback(async () => {
    try {
      const readProvider  = getReadProvider(421614);
      const signer        = await getWriteSigner();
      const user          = await signer.getAddress();

      // cUSDC contract to get USDC address
      const cusdcContract = new ethers.Contract(cUSDCData.address, CUSDC_ABI, readProvider);
      const usdcAddress   = await cusdcContract.usdc();

      // Circle USDC balance
      const usdcContract  = new ethers.Contract(usdcAddress, USDC_ABI, readProvider);
      const rawUsdc       = await usdcContract.balanceOf(user);
      setUsdcBalance(parseFloat(ethers.formatUnits(rawUsdc, 6)).toFixed(2));

      // cUSDC balance — plain ERC20 balanceOf, no FHE
      const rawCusdc = await cusdcContract.balanceOf(user);
      setCusdcBalance(parseFloat(ethers.formatUnits(rawCusdc, 6)).toFixed(2));
    } catch (err) {
      console.error("[fetchBalances]", err);
    }
  }, []);

  useEffect(() => {
    if (window.ethereum && onArb) fetchBalances();
  }, [fetchBalances, onArb]);

  // -------------------------------------------------------------------------
  // Wrap — Circle USDC → cUSDC (plain ERC20, no FHE)
  // -------------------------------------------------------------------------
  const handleWrap = async () => {
    if (!onArb) { setStatus("Switch to Arbitrum Sepolia first"); return; }
    try {
      setLoading(true);
      setLastTxHash(null);

      const signer        = await getWriteSigner();
      const user          = await signer.getAddress();
      const readProvider  = getReadProvider(421614);
      const cusdcContract = new ethers.Contract(cUSDCData.address, CUSDC_ABI, signer);
      const usdcAddress   = await new ethers.Contract(cUSDCData.address, CUSDC_ABI, readProvider).usdc();
      const usdcContract  = new ethers.Contract(usdcAddress, USDC_ABI, signer);
      const usdcRead      = new ethers.Contract(usdcAddress, USDC_ABI, readProvider);
      const parsedAmount  = ethers.parseUnits(amount, 6); // USDC has 6 decimals

      // Approve if needed
      const allowance = await usdcRead.allowance(user, cUSDCData.address);
      if (allowance < parsedAmount) {
        setStatus("Approving USDC…");
        const feeOverrides = await getGasOverrides();
        await (await usdcContract.approve(cUSDCData.address, parsedAmount, feeOverrides)).wait();
      }

      // Wrap — no FHE, just a plain ERC20 mint
      setStatus("Wrapping…");
      const feeOverrides = await getGasOverrides();
      const gasEst = await cusdcContract.wrap.estimateGas(parsedAmount);
      const tx = await cusdcContract.wrap(parsedAmount, {
        gasLimit: gasEst * 120n / 100n,
        ...feeOverrides,
      });
      await tx.wait();

      setLastTxHash(tx.hash);
      setStatus("Wrapped successfully");
      setAmount("");
      fetchBalances();
    } catch (err) {
      console.error("[wrap]", err);
      setStatus(err.reason || err.message || "Wrap failed");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Unwrap — cUSDC → Circle USDC (plain ERC20, no FHE)
  // -------------------------------------------------------------------------
  const handleUnwrap = async () => {
    if (!onArb) { setStatus("Switch to Arbitrum Sepolia first"); return; }
    try {
      setLoading(true);
      setLastTxHash(null);

      const signer        = await getWriteSigner();
      const cusdcContract = new ethers.Contract(cUSDCData.address, CUSDC_ABI, signer);
      // cUSDC uses 18 decimals (ERC20 default), USDC uses 6
      // We parse with 6 decimals since the user thinks in USDC amounts
      // and wrap/unwrap are 1:1 by USDC value
      const parsedAmount  = ethers.parseUnits(amount, 6);

      setStatus("Unwrapping…");
      const feeOverrides = await getGasOverrides();
      const gasEst = await cusdcContract.unwrap.estimateGas(parsedAmount);
      const tx = await cusdcContract.unwrap(parsedAmount, {
        gasLimit: gasEst * 120n / 100n,
        ...feeOverrides,
      });
      await tx.wait();

      setLastTxHash(tx.hash);
      setStatus("Unwrapped successfully");
      setAmount("");
      fetchBalances();
    } catch (err) {
      console.error("[unwrap]", err);
      setStatus(err.reason || err.message || "Unwrap failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = () => {
    if (!amount || loading) return;
    isWrap ? handleWrap() : handleUnwrap();
  };

  const displayBalance = isWrap
    ? `${usdcBalance} USDC`
    : `${cusdcBalance} cUSDC`;

  const canAct = !!amount && !loading && onArb;

  return (
    <div className="min-h-screen pt-28 pb-20 bg-[#020617] text-white flex justify-center px-6">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight text-white">Privacy Bridge</h1>
          <p className="text-slate-500 font-medium mt-2">
            Seamlessly move between public and shielded liquidity.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${onArb ? "bg-emerald-400" : "bg-red-400"}`}/>
              <span className="text-[11px] font-bold text-slate-500">
                {onArb ? "Arbitrum Sepolia" : "Switch to Arbitrum Sepolia"}
              </span>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-2">

          {/* Tabs */}
          <div className="flex p-1.5 bg-slate-950 rounded-[1.8rem] mb-6">
            {["wrap", "unwrap"].map(tab => (
              <button key={tab}
                onClick={() => { setActiveTab(tab); setStatus(""); setLastTxHash(null); }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${
                  activeTab === tab
                    ? "bg-slate-800 text-indigo-400 shadow-lg"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {tab === "wrap" ? "Wrap to cUSDC" : "Unwrap to USDC"}
              </button>
            ))}
          </div>

          <div className="px-6 pb-8 space-y-4">

            {/* Input */}
            <div className="bg-slate-950 border border-slate-800 p-8 rounded-[2rem]">
              <div className="flex justify-between mb-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {isWrap ? "From Public Wallet" : "From cUSDC Balance"}
                </label>
                <button
                  onClick={() => setAmount(isWrap ? usdcBalance : cusdcBalance)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-500"
                >
                  Max: {displayBalance}
                </button>
              </div>
              <input
                type="number" min="0" placeholder="0.00"
                className="w-full bg-transparent text-4xl font-black text-white placeholder:text-slate-800 outline-none"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            {/* Output preview */}
            <div className="bg-slate-950/40 border border-slate-800 p-8 rounded-[2rem]">
              <p className={`text-4xl font-black ${amount ? "text-white" : "text-slate-800"}`}>
                {amount || "0.00"}
              </p>
              <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">
                {isWrap ? "cUSDC received" : "USDC received"}
              </p>
            </div>

            {/* Status */}
            {status && (
              <p className={`text-xs text-center font-medium px-2 ${
                status.toLowerCase().includes("fail") || status.toLowerCase().includes("error") || status.toLowerCase().includes("switch")
                  ? "text-red-400"
                  : status.toLowerCase().includes("success")
                  ? "text-green-400"
                  : "text-indigo-400"
              }`}>
                {status}
              </p>
            )}

            {/* Tx link */}
            {lastTxHash && (
              <a href={`${ARBISCAN}/tx/${lastTxHash}`} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-mono transition-colors">
                {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-8)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            )}

            {/* CTA */}
            <button
              onClick={handleAction}
              disabled={!canAct}
              className={`w-full mt-6 py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all ${
                canAct
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {loading
                ? status || "Processing…"
                : !onArb
                ? "Switch to Arbitrum Sepolia"
                : isWrap
                ? "Confirm Privacy Wrap"
                : "Confirm Unwrap"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default WrapUsdc;