(function () {
  const STORAGE_KEY = 'DemoWalletState_v1';

  // Default prices in USDT (just for demo / UI). Replace with real market data later.
  const DEFAULT_PRICES = {
    USDT: 1,
    BTC: 60000,
    ETH: 3000,
    USDC: 1,
    TRX: 0.1
  };

  function createInitialState() {
    return {
      welcomeBonusGiven: false,
      balances: {
        USDT: 0,
        BTC: 0,
        ETH: 0,
        USDC: 0,
        TRX: 0
      },
      // All values in USDT-equivalent
      totalPersonalIncome: 0,
      todayPersonalIncome: 0,
      totalTeamIncome: 0,
      todayTeamIncome: 0,
      prices: { ...DEFAULT_PRICES },
      // Simple transaction history for Bills page
      transactions: []
    };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createInitialState();
      }
      const parsed = JSON.parse(raw);
      // Ensure all keys exist
      const base = createInitialState();
      const merged = {
        ...base,
        ...parsed,
        balances: { ...base.balances, ...(parsed.balances || {}) },
        prices: { ...base.prices, ...(parsed.prices || {}) }
      };
      return merged;
    } catch (e) {
      console.warn('DemoWallet: failed to load state, resetting.', e);
      return createInitialState();
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('DemoWallet: failed to save state.', e);
    }
  }

  function addTransaction(state, tx) {
    const now = new Date();
    const entry = {
      id: now.getTime().toString(36) + Math.random().toString(36).slice(2),
      type: tx.type,
      fromCurrency: tx.fromCurrency || null,
      toCurrency: tx.toCurrency || null,
      amountFrom: typeof tx.amountFrom === 'number' ? tx.amountFrom : null,
      amountTo: typeof tx.amountTo === 'number' ? tx.amountTo : null,
      amount: typeof tx.amount === 'number' ? tx.amount : null,
      note: tx.note || null,
      rate: typeof tx.rate === 'number' ? tx.rate : null,
      createdAt: now.toISOString()
    };
    state.transactions.unshift(entry);
  }

  function applyWelcomeBonusIfNeeded(state) {
    if (!state.welcomeBonusGiven) {
      const bonus = 3;
      state.balances.USDT += bonus;
      state.totalPersonalIncome += bonus;
      state.todayPersonalIncome += bonus;
      addTransaction(state, {
        type: 'bonus',
        toCurrency: 'USDT',
        amountTo: bonus,
        note: 'Welcome bonus'
      });
      state.welcomeBonusGiven = true;
    }
  }

  function getPrice(state, symbol) {
    if (!symbol) return 0;
    const upper = symbol.toUpperCase();
    return state.prices[upper] != null ? state.prices[upper] : (DEFAULT_PRICES[upper] || 0);
  }

  function computeTotals(state) {
    const values = {};
    let totalUSD = 0;
    Object.keys(state.balances).forEach(function (sym) {
      const balance = Number(state.balances[sym]) || 0;
      const price = getPrice(state, sym);
      const value = balance * price;
      values[sym] = value;
      totalUSD += value;
    });
    return { values, totalUSD };
  }

  function formatNumber(n, decimals) {
    if (!isFinite(n)) return '0';
    const d = typeof decimals === 'number' ? decimals : 2;
    return Number(n).toFixed(d);
  }

  // Update DOM on assets page
  function updateAssetsPage(state) {
    if (typeof document === 'undefined') return;

    const totals = computeTotals(state);
    const totalUSD = totals.totalUSD;

    // Top main amount (we show total in USDT-equivalent)
    const mainAmountEl = document.querySelector('.assets-amount');
    if (mainAmountEl) {
      mainAmountEl.textContent = formatNumber(totalUSD, 2) + ' USDT';
    }

    // Donut center text: ≈$X
    const donutInner = document.querySelector('.donut-inner');
    if (donutInner) {
      const strong = donutInner.querySelector('strong');
      const labelHtml = strong ? strong.outerHTML : '<strong>Total Assets</strong>';
      donutInner.innerHTML = labelHtml + '≈$' + formatNumber(totalUSD, 2);
    }

    // Income fields
    const totalPersonalEl = document.querySelector('.assets-total-personal');
    const totalTeamEl = document.querySelector('.assets-total-team');
    const todayPersonalEl = document.querySelector('.assets-today-personal');
    const todayTeamEl = document.querySelector('.assets-today-team');

    if (totalPersonalEl) {
      totalPersonalEl.textContent = formatNumber(state.totalPersonalIncome, 2) + ' USDT';
    }
    if (totalTeamEl) {
      totalTeamEl.textContent = formatNumber(state.totalTeamIncome, 2) + ' USDT';
    }
    if (todayPersonalEl) {
      todayPersonalEl.textContent = formatNumber(state.todayPersonalIncome, 2) + ' USDT';
    }
    if (todayTeamEl) {
      todayTeamEl.textContent = formatNumber(state.todayTeamIncome, 2) + ' USDT';
    }

    // Token distribution list (top-left list)
    const tokenRows = document.querySelectorAll('.token-list .token-row');
    tokenRows.forEach(function (row) {
      const nameEl = row.querySelector('.token-name');
      const percentEl = row.querySelector('.token-percent');
      if (!nameEl || !percentEl) return;

      const sym = nameEl.textContent.trim().toUpperCase();
      const valueUSD = totals.values[sym] || 0;
      const percent = totalUSD > 0 ? (valueUSD / totalUSD) * 100 : 0;
      percentEl.textContent = formatNumber(percent, 2) + '%';
    });

    // Currency list rows (bottom section)
    const currencyRows = document.querySelectorAll('.currency-list .currency-row');
    currencyRows.forEach(function (row) {
      const nameEl = row.querySelector('.currency-name');
      const amountEl = row.querySelector('.currency-amount');
      if (!nameEl || !amountEl) return;

      const sym = nameEl.textContent.trim().toUpperCase();
      const balance = Number(state.balances[sym]) || 0;
      amountEl.textContent = formatNumber(balance, 4).replace(/\.?0+$/, '');

      // Show/hide withdraw button depending on balance
      const withdrawBtn = row.querySelector('.currency-btn[data-action="Withdraw"]');
      if (withdrawBtn) {
        if (balance <= 0) {
          withdrawBtn.style.display = 'none';
        } else {
          withdrawBtn.style.display = '';
        }
      }
    });
  }

  // Public operations (can be called from other pages)
  function deposit(currency, amount, options) {
    const opts = options || {};
    const sym = String(currency || '').toUpperCase();
    const amt = Number(amount) || 0;
    if (!sym || amt <= 0) return;

    const state = loadState();
    if (!state.balances[sym]) state.balances[sym] = 0;
    state.balances[sym] += amt;

    if (opts.countAsIncome) {
      state.totalPersonalIncome += amt;
      state.todayPersonalIncome += amt;
    }

    addTransaction(state, {
      type: 'deposit',
      toCurrency: sym,
      amountTo: amt,
      note: opts.note || null
    });

    saveState(state);
    // If we are on assets page, refresh view
    updateAssetsPage(state);
    return state;
  }

  function withdraw(currency, amount, options) {
    const opts = options || {};
    const sym = String(currency || '').toUpperCase();
    const amt = Number(amount) || 0;
    if (!sym || amt <= 0) return;

    const state = loadState();
    const current = Number(state.balances[sym]) || 0;
    const finalAmt = Math.min(current, amt);
    state.balances[sym] = current - finalAmt;

    addTransaction(state, {
      type: 'withdraw',
      fromCurrency: sym,
      amountFrom: finalAmt,
      note: opts.note || null
    });

    saveState(state);
    updateAssetsPage(state);
    return state;
  }

  function swap(fromCurrency, toCurrency, amountFrom, explicitRate) {
    const fromSym = String(fromCurrency || '').toUpperCase();
    const toSym = String(toCurrency || '').toUpperCase();
    const amtFrom = Number(amountFrom) || 0;
    if (!fromSym || !toSym || fromSym === toSym || amtFrom <= 0) return;

    const state = loadState();
    const currentFrom = Number(state.balances[fromSym]) || 0;
    const usable = Math.min(currentFrom, amtFrom);

    const rate = typeof explicitRate === 'number' && explicitRate > 0
      ? explicitRate
      : getPrice(state, fromSym) > 0
        ? getPrice(state, fromSym) / (getPrice(state, toSym) || 1)
        : 1;

    const amountTo = usable * rate;

    state.balances[fromSym] = currentFrom - usable;
    if (!state.balances[toSym]) state.balances[toSym] = 0;
    state.balances[toSym] += amountTo;

    addTransaction(state, {
      type: 'swap',
      fromCurrency: fromSym,
      toCurrency: toSym,
      amountFrom: usable,
      amountTo: amountTo,
      rate: rate
    });

    saveState(state);
    updateAssetsPage(state);
    return state;
  }

  function getState() {
    return loadState();
  }

  function setPrices(newPrices) {
    if (!newPrices || typeof newPrices !== 'object') return;
    const state = loadState();
    state.prices = { ...state.prices, ...newPrices };
    saveState(state);
    updateAssetsPage(state);
    return state;
  }

  function applyToAssetsPage() {
    const state = loadState();
    applyWelcomeBonusIfNeeded(state);
    saveState(state);
    updateAssetsPage(state);
  }

  // Expose API
  window.DemoWallet = {
    getState,
    deposit,
    withdraw,
    swap,
    setPrices,
    applyToAssetsPage
  };
})();