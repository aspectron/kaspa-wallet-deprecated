/**
 * @notice This mixin contains generic helper functions
 */
import Vue from 'vue';

export default Vue.extend({
  methods: {
    /**
     * Converts from sompis to KSP
     * @param val Value to convert, as string or number
     * @returns Converted value as a string
     */
    formatBalanceForHuman(val: number | string) {
      return String(Number(val) / 1e8);
    },

    /**
     * Converts from KSP to sompis
     * @param val Value to convert, as string or number
     * @returns Converted value as a string
     */
    formatBalanceForMachine(val: number | string) {
      return Number(val) * 1e8;
    },
  },
});
