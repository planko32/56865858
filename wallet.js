/**
 * Simple in-browser demo wallet used by all pages.
 * Stores data in localStorage so values stay while testing.
 * You can later replace this implementation with Firebase or real backend.
 */
(function (window) {
  var STORAGE_KEY = 'demoWallet_v1';

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function createInitialState() {
    // New user bonus: 3 USDT
    return {
      balances: {
        USDT: 3,
        BTC: 0,
        ETH: 0,
        USDC: 0,
        TRX: 0
      },
      income: {
        personalToday: 0,
        personalTotal: 0,
        teamToday: 0,
        teamTotal: 0
      },
      // For withdraw page: how many AI runs completed (from AI Power)
      totalIncomeRuns: 0,
      // Bills history (deposit, withdraw, swap, income, bonus)
      transactions: [],
      // Simple team summary for My Team (can be extended later)
      teamSummary: {
        teamSize: 0,
        todayIncome: 0,
        totalIncome: 0,
        generations: {
          1: { effective: 0, percent: 20, income: 0 },
          2: { effective: 0, percent: 5, income: 0 },
          3: { effective: 0, percent: 3, income: 0 }
        },
        members: []
      }
    };
  }

  function getState() {
    var state = loadState();
    if (!state) {
      state = createInitialState();
      saveState(state);
    }
    // Ensure all keys exist (in case of older data)
    if (!state.balances) state.balances = { USDT: 0, BTC: 0, ETH: 0, USDC: 0, TRX: 0 };
    if (!state.income) state.income = { personalToday: 0, personalTotal: 0, teamToday: 0, teamTotal: 0 };
    if (!state.transactions) state.transactions = [];
    if (!state.teamSummary) state.teamSummary = createInitialState().teamSummary;
    return state;
  }

  function addTransaction(tx) {
    var state = getState();
    tx.id = tx.id || ('TX' + Date.now() + Math.floor(Math.random() * 100000));
    tx.createdAt = tx.createdAt || new Date().toISOString();
    state.transactions.unshift(tx);
    saveState(state);
  }

  function getWalletSummary() {
    var state = getState();
    var totalUSDT = 0;
    // assume 1:1 value for demo
    Object.keys(state.balances).forEach(function (k) {
      totalUSDT += Number(state.balances[k]) || 0;
    });
    return {
      balance: Number(state.balances.USDT) || 0,
      balances: state.balances,
      totalUSDT: totalUSDT,
      totalIncome: Number(state.income.personalTotal) || 0,
      todayIncome: Number(state.income.personalToday) || 0,
      teamTotalIncome: Number(state.income.teamTotal) || 0,
      teamTodayIncome: Number(state.income.teamToday) || 0
    };
  }

  // Public API
  var DemoWallet = {
    // basic access
    getState: getState,
    saveState: saveState,
    getWallet: getWalletSummary,

    // income from AI‑Power etc.
    addIncome: function (amount) {
      var a = Number(amount) || 0;
      if (a <= 0) return;
      var state = getState();
      state.balances.USDT += a;
      state.income.personalToday += a;
      state.income.personalTotal += a;
      state.totalIncomeRuns += 1;
      addTransaction({
        type: 'income',
        currency: 'USDT',
        amount: a,
        fee: 0,
        net: a,
        direction: 'in',
        status: 'Succeeded',
        remark: 'AI Power income'
      });
      saveState(state);
    },

    // deposit in any currency
    deposit: function (currency, amount) {
      var code = currency || 'USDT';
      var a = Number(amount) || 0;
      if (a <= 0) return null;
      var state = getState();
      if (!state.balances[code]) state.balances[code] = 0;
      state.balances[code] += a;
      addTransaction({
        type: 'deposit',
        currency: code,
        amount: a,
        fee: 0,
        net: a,
        direction: 'in',
        status: 'Succeeded',
        remark: 'Manual deposit'
      });
      saveState(state);
      return getWalletSummary();
    },

    // withdraw USDT only (for now)
    withdraw: function (amount) {
      var a = Number(amount) || 0;
      if (a <= 0) return null;
      var state = getState();
      var bal = Number(state.balances.USDT) || 0;
      if (a > bal) return null;
      var fee = a * 0.05;
      var net = a - fee;
      state.balances.USDT = bal - a;
      addTransaction({
        type: 'withdraw',
        currency: 'USDT',
        amount: a,
        fee: fee,
        net: net,
        direction: 'out',
        status: 'Pending',
        remark: 'Withdraw request'
      });
      saveState(state);
      return getWalletSummary();
    },

    // swap one currency to another using simple fixed prices
    recordSwap: function (fromCurrency, toCurrency, amount, received) {
      var from = fromCurrency || 'USDT';
      var to = toCurrency || 'USDC';
      var a = Number(amount) || 0;
      var r = Number(received) || 0;
      if (a <= 0 || r <= 0) return null;
      var state = getState();
      if (!state.balances[from] || state.balances[from] < a) return null;
      if (!state.balances[to]) state.balances[to] = 0;
      state.balances[from] -= a;
      state.balances[to] += r;
      addTransaction({
        type: 'swap',
        currency: from + '→' + to,
        amount: a,
        fee: 0,
        net: r,
        direction: 'swap',
        status: 'Succeeded',
        remark: 'Swap operation'
      });
      saveState(state);
      return getWalletSummary();
    },

    getTransactions: function () {
      var state = getState();
      return state.transactions.slice();
    },

    // Called from my-assets.html to sync DOM with state
    applyToAssetsPage: function () {
      var summary = getWalletSummary();
      var balances = summary.balances || {};
      var total = summary.totalUSDT || 0;
      if (total <= 0) total = 1; // avoid division by zero

      // total account assets (left big number)
      var totalEl = document.querySelector('.assets-usdt-balance');
      if (totalEl) {
        totalEl.textContent = summary.balance.toFixed(2) + ' USDT';
      }

      // donut inner text
      var inner = document.querySelector('.donut-inner');
      if (inner) {
        inner.innerHTML = '<strong>Total Assets</strong><br/>≈$' + total.toFixed(2);
      }

      // token percentages
      var mapping = {
        USDT: '.token-row .token-name:nth-of-type(1)',
      };

      var rows = document.querySelectorAll('.token-row');
      function setPercent(rowIndex, value) {
        var row = rows[rowIndex];
        if (!row) return;
        var span = row.querySelector('.token-percent');
        if (span) span.textContent = value.toFixed(2) + '%';
      }

      var usdt = Number(balances.USDT) || 0;
      var btc = Number(balances.BTC) || 0;
      var eth = Number(balances.ETH) || 0;
      var usdc = Number(balances.USDC) || 0;
      var trx = Number(balances.TRX) || 0;
      total = usdt + btc + eth + usdc + trx;
      if (total <= 0) total = 1;

      var percentages = [usdt, btc, eth, usdc, trx].map(function (v) {
        return (v / total) * 100;
      });

      percentages.forEach(function (p, idx) {
        setPercent(idx, p);
      });

      // income block
      var tp = document.querySelector('.assets-total-personal');
      if (tp) tp.textContent = summary.totalIncome.toFixed(2) + ' USDT';
      var tt = document.querySelector('.assets-total-team');
      if (tt) tt.textContent = summary.teamTotalIncome.toFixed(2) + ' USDT';
      var tpd = document.querySelector('.assets-today-personal');
      if (tpd) tpd.textContent = summary.todayIncome.toFixed(2) + ' USDT';
      var ttd = document.querySelector('.assets-today-team');
      if (ttd) ttd.textContent = summary.teamTodayIncome.toFixed(2) + ' USDT';

      // currency list balances
      var rows2 = document.querySelectorAll('.currency-row');
      var codes = ['USDT', 'BTC', 'ETH', 'USDC', 'TRX'];
      rows2.forEach(function (row, idx) {
        var code = codes[idx];
        var amountEl = row.querySelector('.currency-amount');
        if (amountEl) {
          var val = Number(balances[code]) || 0;
          amountEl.textContent = val.toFixed(2).replace(/\.00$/, '');
        }
      });
    },

    // Simple team summary used by My Team (all zeros for now)
    getTeamSummary: function () {
      return getState().teamSummary;
    }
  };

  window.DemoWallet = DemoWallet;
})(window);
