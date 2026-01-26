def max_seating_capacity(N, Y, S):
    max_sum = sum(S)
    
    # Try all possible starting points of the subarray
    for i in range(N):
        current_sum = 0
        current_max_increase = 0
        
        # Try all possible ending points of the subarray starting from i
        for j in range(i, N):
            current_sum ^= S[j]
            
            # Calculate the increase if we XOR this subarray with Y
            increase = current_sum ^ Y
            
            # Update the maximum increase encountered
            current_max_increase = max(current_max_increase, increase)
        
        # Update the global maximum sum
        max_sum = max(max_sum, sum(S[:i]) + current_max_increase + sum(S[j+1:]))

    return max_sum

# Read input
T = int(input().strip())
results = []

for _ in range(T):
    N, Y = map(int, input().strip().split())
    S = list(map(int, input().strip().split()))
    
    result = max_seating_capacity(N, Y, S)
    results.append(result)

# Output the results
for res in results:
    print(res)
