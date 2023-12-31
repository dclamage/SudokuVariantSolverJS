import { combinations, permutations } from '../src/solver/SolveUtility';

describe('permutations function', () => {
    const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

    const testPermutations = (inputArray: number[]) => {
        const results = Array.from(permutations(inputArray));
        const expectedLength = factorial(inputArray.length);
        expect(results).toHaveLength(expectedLength);

        const uniqueResults = new Set(results.map(result => JSON.stringify(result)));
        expect(uniqueResults.size).toBe(expectedLength);
    };

    it('generates correct permutations for an array of length 6', () => {
        testPermutations([1, 2, 3, 4, 5, 6]);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct permutations for an array of length 3', () => {
        testPermutations([1, 2, 3]);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct permutations for an array of length 1', () => {
        testPermutations([1]);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct permutations for an empty array', () => {
        testPermutations([]);
        expect(true).toBe(true); // Add an assertion
    });
});

describe('combinations function', () => {
    function factorial(n: number): number {
        return n <= 1 ? 1 : n * factorial(n - 1);
    }

    function binomialCoefficient(n: number, k: number): number {
        return factorial(n) / (factorial(k) * factorial(n - k));
    }

    function testCombinations(inputArray: number[], size: number) {
        const results = Array.from(combinations(inputArray, size));
        const expectedLength = binomialCoefficient(inputArray.length, size);
        expect(results).toHaveLength(expectedLength);

        // Check for uniqueness and correct size of each combination
        const uniqueResults = new Set(results.map(result => JSON.stringify(result)));
        expect(uniqueResults.size).toBe(expectedLength);
        results.forEach(combination => {
            expect(combination).toHaveLength(size);
        });
    }

    it('generates correct combinations perf test', () => {
        for (let i = 0; i < 100; i++) {
            testCombinations([1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
        }
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct combinations for an array of length 9 and size 4', () => {
        testCombinations([1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct combinations for an array of length 4 and size 2', () => {
        testCombinations([1, 2, 3, 4], 2);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct combinations for an array of length 3 and size 1', () => {
        testCombinations([1, 2, 3], 1);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct combinations for an array of length 5 and size 3', () => {
        testCombinations([1, 2, 3, 4, 5], 3);
        expect(true).toBe(true); // Add an assertion
    });

    it('generates correct combinations for an array of length 3 and size 0', () => {
        testCombinations([1, 2, 3], 0);
        expect(true).toBe(true); // Add an assertion
    });

    // Add more test cases as necessary
});
