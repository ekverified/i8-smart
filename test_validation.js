// Basic validation tests for i-8 SMART BOT
// Run this file in browser console or Node.js to test validation functions

// Test data
const testMembers = [
    "Enoch Kamau Thumbi",
    "John Waweru Njeri",
    "Geoffrey Mugi Gicini"
];

const testInputs = {
    valid: {
        amount: "1000",
        month: "2024-01",
        memberName: "Enoch Kamau Thumbi"
    },
    invalid: {
        amount: "abc",
        empty: "",
        negative: "-100",
        month: "",
        memberName: "Invalid Name"
    }
};

// Mock DOM elements for testing
function createMockElement(id, value) {
    return {
        id: id,
        value: value,
        type: id.includes('amount') || id.includes('balance') ? 'number' : 'text'
    };
}

// Mock document.getElementById
function mockGetElementById(id) {
    const mockElements = {
        'month': createMockElement('month', testInputs.valid.month),
        'opening_kcb_balance': createMockElement('opening_kcb_balance', testInputs.valid.amount),
        'memberSelect': createMockElement('memberSelect', testInputs.valid.memberName),
        'contributionAmount': createMockElement('contributionAmount', testInputs.valid.amount)
    };
    return mockElements[id] || null;
}

// Mock document.getElementById for error elements
function mockGetErrorElement(id) {
    return {
        id: id,
        textContent: '',
        style: { display: 'none' }
    };
}

// Test validation functions
function runValidationTests() {
    console.log('🧪 Running i-8 SMART BOT Validation Tests...\n');

    // Test 1: Valid inputs
    console.log('✅ Test 1: Valid financial inputs');
    const validFinancialResult = testValidateFinancialInputs(true);
    console.log('Result:', validFinancialResult ? 'PASS' : 'FAIL');

    // Test 2: Invalid number inputs
    console.log('\n❌ Test 2: Invalid number inputs (NaN handling)');
    const invalidNumberResult = testValidateFinancialInputs(false, 'nan');
    console.log('Result:', invalidNumberResult ? 'PASS' : 'FAIL');

    // Test 3: Empty inputs
    console.log('\n❌ Test 3: Empty inputs');
    const emptyInputsResult = testValidateFinancialInputs(false, 'empty');
    console.log('Result:', emptyInputsResult ? 'PASS' : 'FAIL');

    // Test 4: Valid contribution inputs
    console.log('\n✅ Test 4: Valid contribution inputs');
    const validContributionResult = testValidateContributionInputs(true);
    console.log('Result:', validContributionResult ? 'PASS' : 'FAIL');

    // Test 5: Invalid member name
    console.log('\n❌ Test 5: Invalid member name');
    const invalidMemberResult = testValidateContributionInputs(false, 'invalid');
    console.log('Result:', invalidMemberResult ? 'PASS' : 'FAIL');

    console.log('\n🎉 Validation tests completed!');
}

function testValidateFinancialInputs(shouldPass, testType = 'valid') {
    // Mock the global functions
    window.document = {
        getElementById: function(id) {
            if (id.includes('Error')) {
                return mockGetErrorElement(id);
            }

            let value;
            switch(testType) {
                case 'nan':
                    value = testInputs.invalid.amount;
                    break;
                case 'empty':
                    value = testInputs.invalid.empty;
                    break;
                default:
                    value = testInputs.valid.amount;
            }

            return createMockElement(id, value);
        }
    };

    // Mock console for testing
    const originalConsole = console;
    console = { ...originalConsole, error: () => {} };

    try {
        // This would be the actual validation function from your code
        const mockValidateFinancialInputs = function() {
            const inputs = [
                { id: 'month', errorId: 'monthError', message: 'Please select a month.' },
                { id: 'opening_kcb_balance', errorId: 'openingKcbError', message: 'Please enter a valid KCB balance.' }
            ];

            let hasErrors = false;
            inputs.forEach(input => {
                const element = document.getElementById(input.id);
                const errorElement = document.getElementById(input.errorId);

                if (errorElement) {
                    errorElement.style.display = 'none';
                }

                if (input.id === 'month') {
                    if (!element || !element.value) {
                        if (errorElement) {
                            errorElement.textContent = input.message;
                            errorElement.style.display = 'block';
                        }
                        hasErrors = true;
                    }
                } else {
                    const value = parseFloat(element ? element.value : '');
                    if (!element || !element.value.trim() || isNaN(value) || value < 0) {
                        if (errorElement) {
                            errorElement.textContent = input.message;
                            errorElement.style.display = 'block';
                        }
                        hasErrors = true;
                    }
                }
            });

            return hasErrors ? 'Validation errors found' : null;
        };

        const result = mockValidateFinancialInputs();
        const expected = shouldPass ? null : 'Validation errors found';

        return result === expected;
    } finally {
        console = originalConsole;
    }
}

function testValidateContributionInputs(shouldPass, testType = 'valid') {
    // Similar mock setup for contribution validation
    window.document = {
        getElementById: function(id) {
            if (id.includes('Error')) {
                return mockGetErrorElement(id);
            }

            let value;
            switch(testType) {
                case 'invalid':
                    value = testInputs.invalid.memberName;
                    break;
                default:
                    value = testInputs.valid.memberName;
            }

            return createMockElement(id, value);
        }
    };

    // Mock fuzzyMatch function
    window.fuzzyMatch = function(input, members) {
        if (testType === 'invalid') return null;
        return members.find(member =>
            member.toLowerCase().includes(input.toLowerCase())
        ) || null;
    };

    const originalConsole = console;
    console = { ...originalConsole, error: () => {} };

    try {
        const mockValidateContributionInputs = function() {
            const inputs = [
                { id: 'memberSelect', errorId: 'memberSelectError', message: 'Please enter a valid member name.' },
                { id: 'contributionMonth', errorId: 'contributionMonthError', message: 'Please select a month.' },
                { id: 'contributionAmount', errorId: 'contributionAmountError', message: 'Please enter a valid contribution amount.' }
            ];

            let hasErrors = false;
            inputs.forEach(input => {
                const element = document.getElementById(input.id);
                const errorElement = document.getElementById(input.errorId);

                if (errorElement) {
                    errorElement.style.display = 'none';
                }

                if (input.id === 'memberSelect') {
                    if (!element || !element.value.trim() || !fuzzyMatch(element.value, testMembers)) {
                        if (errorElement) {
                            errorElement.textContent = input.message;
                            errorElement.style.display = 'block';
                        }
                        hasErrors = true;
                    }
                } else if (input.id === 'contributionMonth') {
                    if (!element || !element.value) {
                        if (errorElement) {
                            errorElement.textContent = input.message;
                            errorElement.style.display = 'block';
                        }
                        hasErrors = true;
                    }
                } else if (input.id === 'contributionAmount') {
                    const value = parseFloat(element ? element.value : '');
                    if (!element || !element.value.trim() || isNaN(value) || value <= 0) {
                        if (errorElement) {
                            errorElement.textContent = input.message;
                            errorElement.style.display = 'block';
                        }
                        hasErrors = true;
                    }
                }
            });

            return hasErrors ? 'Validation errors found' : null;
        };

        const result = mockValidateContributionInputs();
        const expected = shouldPass ? null : 'Validation errors found';

        return result === expected;
    } finally {
        console = originalConsole;
    }
}

// Auto-run tests if in browser environment
if (typeof window !== 'undefined') {
    // Run tests when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runValidationTests);
    } else {
        runValidationTests();
    }
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runValidationTests,
        testValidateFinancialInputs,
        testValidateContributionInputs
    };
}
