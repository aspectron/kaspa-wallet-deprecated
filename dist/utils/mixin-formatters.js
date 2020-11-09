"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @notice This mixin contains generic helper functions
 */
const vue_1 = require("vue");
exports.default = vue_1.default.extend({
    methods: {
        /**
         * Converts from sompis to KSP
         * @param val Value to convert, as string or number
         * @returns Converted value as a string
         */
        formatBalanceForHuman(val) {
            return String(Number(val) / 1e8);
        },
        /**
         * Converts from KSP to sompis
         * @param val Value to convert, as string or number
         * @returns Converted value as a string
         */
        formatBalanceForMachine(val) {
            return Number(val) * 1e8;
        },
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWl4aW4tZm9ybWF0dGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3V0aWxzL21peGluLWZvcm1hdHRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7R0FFRztBQUNILDZCQUFzQjtBQUV0QixrQkFBZSxhQUFHLENBQUMsTUFBTSxDQUFDO0lBQ3hCLE9BQU8sRUFBRTtRQUNQOzs7O1dBSUc7UUFDSCxxQkFBcUIsQ0FBQyxHQUFvQjtZQUN4QyxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUVEOzs7O1dBSUc7UUFDSCx1QkFBdUIsQ0FBQyxHQUFvQjtZQUMxQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDM0IsQ0FBQztLQUNGO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbm90aWNlIFRoaXMgbWl4aW4gY29udGFpbnMgZ2VuZXJpYyBoZWxwZXIgZnVuY3Rpb25zXG4gKi9cbmltcG9ydCBWdWUgZnJvbSAndnVlJztcblxuZXhwb3J0IGRlZmF1bHQgVnVlLmV4dGVuZCh7XG4gIG1ldGhvZHM6IHtcbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBmcm9tIHNvbXBpcyB0byBLU1BcbiAgICAgKiBAcGFyYW0gdmFsIFZhbHVlIHRvIGNvbnZlcnQsIGFzIHN0cmluZyBvciBudW1iZXJcbiAgICAgKiBAcmV0dXJucyBDb252ZXJ0ZWQgdmFsdWUgYXMgYSBzdHJpbmdcbiAgICAgKi9cbiAgICBmb3JtYXRCYWxhbmNlRm9ySHVtYW4odmFsOiBudW1iZXIgfCBzdHJpbmcpIHtcbiAgICAgIHJldHVybiBTdHJpbmcoTnVtYmVyKHZhbCkgLyAxZTgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBmcm9tIEtTUCB0byBzb21waXNcbiAgICAgKiBAcGFyYW0gdmFsIFZhbHVlIHRvIGNvbnZlcnQsIGFzIHN0cmluZyBvciBudW1iZXJcbiAgICAgKiBAcmV0dXJucyBDb252ZXJ0ZWQgdmFsdWUgYXMgYSBzdHJpbmdcbiAgICAgKi9cbiAgICBmb3JtYXRCYWxhbmNlRm9yTWFjaGluZSh2YWw6IG51bWJlciB8IHN0cmluZykge1xuICAgICAgcmV0dXJuIE51bWJlcih2YWwpICogMWU4O1xuICAgIH0sXG4gIH0sXG59KTtcbiJdfQ==