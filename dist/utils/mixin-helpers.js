"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @notice This mixin contains generic helper functions
 */
const vue_1 = require("vue");
const quasar_1 = require("quasar");
exports.default = vue_1.default.extend({
    data() {
        return {
            passwordHint: 'At least 8 characters, one capital, one lower, one number, and one symbol',
        };
    },
    methods: {
        /**
         * Clears form validations for the ref specified
         * @param ref name of ref to reset
         */
        resetFormValidations(ref) {
            if (this.$refs[ref]) {
                // @ts-ignore
                this.$refs[ref].resetValidation(); // eslint-disable-line
            }
        },
        /**
         * Checks if a single password meets the requirements. Used as the rules function
         * for input components
         * @param password Password to check
         * @returns true if password is valid, error message otherwise
         */
        checkPasswordRequirements(password) {
            const regex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;
            return regex.test(password) || this.passwordHint;
        },
        /**
         * Verifies that both passwords match. Returns a function so it can be used in input rules
         * @param password1 First password to check
         * @param password2 Second password to check
         * @returns function that returns true if password is valid, error message otherwise
         */
        verifyPasswordsMatch(password1, password2) {
            const passwordsMatch = () => {
                return password1 === password2 || 'Passwords do not match';
            };
            return passwordsMatch;
        },
        /**
         * Present notification alert to the user
         * @param {string} color alert color, choose positive, negative, warning, info, or others
         * @param {string} message message to display on notification
         */
        notifyUser(color, message) {
            quasar_1.Notify.create({
                color,
                message,
                timeout: color.toLowerCase() === 'negative' ? 10000 : 5000,
                position: 'top',
                actions: [{ label: 'Dismiss', color: 'white' }],
            });
        },
        /* eslint-disable */
        /**
         * Show error message to user
         * @param {Any} err Error object thrown
         * @param {Any} msg Optional, fallback error message if one is not provided by the err object
         */
        showError(err, msg = 'An unknown error occurred') {
            console.error(err);
            if (!err)
                this.notifyUser('negative', msg);
            else if (err.message)
                this.notifyUser('negative', err.message);
            else if (err.msg)
                this.notifyUser('negative', err.msg);
            else if (typeof err === 'string')
                this.notifyUser('negative', err);
            else
                this.notifyUser('negative', msg);
        },
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWl4aW4taGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3V0aWxzL21peGluLWhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7R0FFRztBQUNILDZCQUFzQjtBQUN0QixtQ0FBZ0M7QUFFaEMsa0JBQWUsYUFBRyxDQUFDLE1BQU0sQ0FBQztJQUN4QixJQUFJO1FBQ0YsT0FBTztZQUNMLFlBQVksRUFBRSwyRUFBMkU7U0FDMUYsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLEVBQUU7UUFDUDs7O1dBR0c7UUFDSCxvQkFBb0IsQ0FBQyxHQUFXO1lBQzlCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDbkIsYUFBYTtnQkFDYixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsc0JBQXNCO2FBQzFEO1FBQ0gsQ0FBQztRQUVEOzs7OztXQUtHO1FBQ0gseUJBQXlCLENBQUMsUUFBZ0I7WUFDeEMsTUFBTSxLQUFLLEdBQUcsZ0VBQWdFLENBQUM7WUFDL0UsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDbkQsQ0FBQztRQUVEOzs7OztXQUtHO1FBQ0gsb0JBQW9CLENBQUMsU0FBaUIsRUFBRSxTQUFpQjtZQUN2RCxNQUFNLGNBQWMsR0FBRyxHQUFHLEVBQUU7Z0JBQzFCLE9BQU8sU0FBUyxLQUFLLFNBQVMsSUFBSSx3QkFBd0IsQ0FBQztZQUM3RCxDQUFDLENBQUM7WUFDRixPQUFPLGNBQWMsQ0FBQztRQUN4QixDQUFDO1FBRUQ7Ozs7V0FJRztRQUNILFVBQVUsQ0FBQyxLQUFhLEVBQUUsT0FBZTtZQUN2QyxlQUFNLENBQUMsTUFBTSxDQUFDO2dCQUNaLEtBQUs7Z0JBQ0wsT0FBTztnQkFDUCxPQUFPLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUMxRCxRQUFRLEVBQUUsS0FBSztnQkFDZixPQUFPLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDO2FBQ2hELENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxvQkFBb0I7UUFDcEI7Ozs7V0FJRztRQUNILFNBQVMsQ0FBQyxHQUFRLEVBQUUsR0FBRyxHQUFHLDJCQUEyQjtZQUNuRCxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25CLElBQUksQ0FBQyxHQUFHO2dCQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUN0QyxJQUFJLEdBQUcsQ0FBQyxPQUFPO2dCQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDMUQsSUFBSSxHQUFHLENBQUMsR0FBRztnQkFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7aUJBQ2xELElBQUksT0FBTyxHQUFHLEtBQUssUUFBUTtnQkFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQzs7Z0JBQzlELElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7S0FDRjtDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG5vdGljZSBUaGlzIG1peGluIGNvbnRhaW5zIGdlbmVyaWMgaGVscGVyIGZ1bmN0aW9uc1xuICovXG5pbXBvcnQgVnVlIGZyb20gJ3Z1ZSc7XG5pbXBvcnQgeyBOb3RpZnkgfSBmcm9tICdxdWFzYXInO1xuXG5leHBvcnQgZGVmYXVsdCBWdWUuZXh0ZW5kKHtcbiAgZGF0YSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcGFzc3dvcmRIaW50OiAnQXQgbGVhc3QgOCBjaGFyYWN0ZXJzLCBvbmUgY2FwaXRhbCwgb25lIGxvd2VyLCBvbmUgbnVtYmVyLCBhbmQgb25lIHN5bWJvbCcsXG4gICAgfTtcbiAgfSxcblxuICBtZXRob2RzOiB7XG4gICAgLyoqXG4gICAgICogQ2xlYXJzIGZvcm0gdmFsaWRhdGlvbnMgZm9yIHRoZSByZWYgc3BlY2lmaWVkXG4gICAgICogQHBhcmFtIHJlZiBuYW1lIG9mIHJlZiB0byByZXNldFxuICAgICAqL1xuICAgIHJlc2V0Rm9ybVZhbGlkYXRpb25zKHJlZjogc3RyaW5nKSB7XG4gICAgICBpZiAodGhpcy4kcmVmc1tyZWZdKSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgdGhpcy4kcmVmc1tyZWZdLnJlc2V0VmFsaWRhdGlvbigpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIHNpbmdsZSBwYXNzd29yZCBtZWV0cyB0aGUgcmVxdWlyZW1lbnRzLiBVc2VkIGFzIHRoZSBydWxlcyBmdW5jdGlvblxuICAgICAqIGZvciBpbnB1dCBjb21wb25lbnRzXG4gICAgICogQHBhcmFtIHBhc3N3b3JkIFBhc3N3b3JkIHRvIGNoZWNrXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBwYXNzd29yZCBpcyB2YWxpZCwgZXJyb3IgbWVzc2FnZSBvdGhlcndpc2VcbiAgICAgKi9cbiAgICBjaGVja1Bhc3N3b3JkUmVxdWlyZW1lbnRzKHBhc3N3b3JkOiBzdHJpbmcpIHtcbiAgICAgIGNvbnN0IHJlZ2V4ID0gL14oPz0uKj9bQS1aXSkoPz0uKj9bYS16XSkoPz0uKj9bMC05XSkoPz0uKj9bIz8hQCQlXiYqLV0pLns4LH0kLztcbiAgICAgIHJldHVybiByZWdleC50ZXN0KHBhc3N3b3JkKSB8fCB0aGlzLnBhc3N3b3JkSGludDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVmVyaWZpZXMgdGhhdCBib3RoIHBhc3N3b3JkcyBtYXRjaC4gUmV0dXJucyBhIGZ1bmN0aW9uIHNvIGl0IGNhbiBiZSB1c2VkIGluIGlucHV0IHJ1bGVzXG4gICAgICogQHBhcmFtIHBhc3N3b3JkMSBGaXJzdCBwYXNzd29yZCB0byBjaGVja1xuICAgICAqIEBwYXJhbSBwYXNzd29yZDIgU2Vjb25kIHBhc3N3b3JkIHRvIGNoZWNrXG4gICAgICogQHJldHVybnMgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRydWUgaWYgcGFzc3dvcmQgaXMgdmFsaWQsIGVycm9yIG1lc3NhZ2Ugb3RoZXJ3aXNlXG4gICAgICovXG4gICAgdmVyaWZ5UGFzc3dvcmRzTWF0Y2gocGFzc3dvcmQxOiBzdHJpbmcsIHBhc3N3b3JkMjogc3RyaW5nKSB7XG4gICAgICBjb25zdCBwYXNzd29yZHNNYXRjaCA9ICgpID0+IHtcbiAgICAgICAgcmV0dXJuIHBhc3N3b3JkMSA9PT0gcGFzc3dvcmQyIHx8ICdQYXNzd29yZHMgZG8gbm90IG1hdGNoJztcbiAgICAgIH07XG4gICAgICByZXR1cm4gcGFzc3dvcmRzTWF0Y2g7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFByZXNlbnQgbm90aWZpY2F0aW9uIGFsZXJ0IHRvIHRoZSB1c2VyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbG9yIGFsZXJ0IGNvbG9yLCBjaG9vc2UgcG9zaXRpdmUsIG5lZ2F0aXZlLCB3YXJuaW5nLCBpbmZvLCBvciBvdGhlcnNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBtZXNzYWdlIHRvIGRpc3BsYXkgb24gbm90aWZpY2F0aW9uXG4gICAgICovXG4gICAgbm90aWZ5VXNlcihjb2xvcjogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICAgIE5vdGlmeS5jcmVhdGUoe1xuICAgICAgICBjb2xvcixcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgdGltZW91dDogY29sb3IudG9Mb3dlckNhc2UoKSA9PT0gJ25lZ2F0aXZlJyA/IDEwMDAwIDogNTAwMCxcbiAgICAgICAgcG9zaXRpb246ICd0b3AnLFxuICAgICAgICBhY3Rpb25zOiBbeyBsYWJlbDogJ0Rpc21pc3MnLCBjb2xvcjogJ3doaXRlJyB9XSxcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKiBlc2xpbnQtZGlzYWJsZSAqL1xuICAgIC8qKlxuICAgICAqIFNob3cgZXJyb3IgbWVzc2FnZSB0byB1c2VyXG4gICAgICogQHBhcmFtIHtBbnl9IGVyciBFcnJvciBvYmplY3QgdGhyb3duXG4gICAgICogQHBhcmFtIHtBbnl9IG1zZyBPcHRpb25hbCwgZmFsbGJhY2sgZXJyb3IgbWVzc2FnZSBpZiBvbmUgaXMgbm90IHByb3ZpZGVkIGJ5IHRoZSBlcnIgb2JqZWN0XG4gICAgICovXG4gICAgc2hvd0Vycm9yKGVycjogYW55LCBtc2cgPSAnQW4gdW5rbm93biBlcnJvciBvY2N1cnJlZCcpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgIGlmICghZXJyKSB0aGlzLm5vdGlmeVVzZXIoJ25lZ2F0aXZlJywgbXNnKTtcbiAgICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlKSB0aGlzLm5vdGlmeVVzZXIoJ25lZ2F0aXZlJywgZXJyLm1lc3NhZ2UpO1xuICAgICAgZWxzZSBpZiAoZXJyLm1zZykgdGhpcy5ub3RpZnlVc2VyKCduZWdhdGl2ZScsIGVyci5tc2cpO1xuICAgICAgZWxzZSBpZiAodHlwZW9mIGVyciA9PT0gJ3N0cmluZycpIHRoaXMubm90aWZ5VXNlcignbmVnYXRpdmUnLCBlcnIpO1xuICAgICAgZWxzZSB0aGlzLm5vdGlmeVVzZXIoJ25lZ2F0aXZlJywgbXNnKTtcbiAgICB9LFxuICB9LFxufSk7XG4iXX0=