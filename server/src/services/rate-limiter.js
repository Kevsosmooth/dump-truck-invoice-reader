/**
 * Rate Limiter Service
 * Implements token bucket algorithm for Azure API rate limiting
 * Supports tier-based rate limiting:
 * - STANDARD (S0): 15 requests/second
 * - FREE (F0): 1 request/second
 */

// Tier configurations
const TIER_CONFIGS = {
  STANDARD: {
    maxTokens: 15,
    refillRate: 15,
    maxConcurrent: 15,
    description: 'S0 Standard Tier - 15 req/sec'
  },
  FREE: {
    maxTokens: 1,
    refillRate: 1,
    maxConcurrent: 1,
    description: 'F0 Free Tier - 1 req/sec'
  }
};

// Get tier from environment variable
const tier = process.env.AZURE_TIER || 'FREE';
const tierConfig = TIER_CONFIGS[tier.toUpperCase()] || TIER_CONFIGS.FREE;

console.log(`[RATE-LIMITER] Initializing with ${tierConfig.description}`);
console.log(`[RATE-LIMITER] Max concurrent requests: ${tierConfig.maxConcurrent}`);

class RateLimiter {
  constructor(options = {}) {
    // Token bucket configuration based on tier
    this.maxTokens = options.maxTokens || tierConfig.maxTokens;
    this.refillRate = options.refillRate || tierConfig.refillRate;
    this.tokens = this.maxTokens; // Current available tokens
    
    // Queue management
    this.queue = [];
    this.processing = false;
    
    // Request tracking
    this.requestCount = 0;
    this.lastRefillTime = Date.now();
    
    // Backoff configuration
    this.minBackoff = options.minBackoff || 100; // Minimum backoff in ms
    this.maxBackoff = options.maxBackoff || 60000; // Maximum backoff in ms
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.currentBackoff = this.minBackoff;
    this.consecutiveFailures = 0;
    
    // Start token refill timer
    this.startRefillTimer();
  }

  /**
   * Start the token refill timer
   */
  startRefillTimer() {
    setInterval(() => {
      this.refillTokens();
    }, 1000 / this.refillRate); // Refill tokens based on rate
  }

  /**
   * Refill tokens based on elapsed time
   */
  refillTokens() {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000; // Convert to seconds
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
      
      // Process queue if tokens are available
      if (this.tokens > 0 && this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }
  }

  /**
   * Check if a request can be made immediately
   * @returns {boolean} True if request can be made, false otherwise
   */
  canMakeRequest() {
    this.refillTokens(); // Ensure tokens are up to date
    
    if (this.tokens > 0) {
      this.tokens--;
      this.requestCount++;
      this.consecutiveFailures = 0; // Reset failures on successful request
      this.currentBackoff = this.minBackoff; // Reset backoff
      return true;
    }
    
    return false;
  }

  /**
   * Wait for next available token
   * @returns {Promise<void>} Resolves when token is available
   */
  async waitForToken() {
    // Try immediate request
    if (this.canMakeRequest()) {
      return;
    }

    // Add to queue and wait
    return new Promise((resolve) => {
      this.queue.push({
        resolve,
        timestamp: Date.now()
      });
      
      // Start processing queue if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      this.refillTokens();
      
      if (this.tokens > 0) {
        const request = this.queue.shift();
        this.tokens--;
        this.requestCount++;
        this.consecutiveFailures = 0;
        this.currentBackoff = this.minBackoff;
        request.resolve();
      } else {
        // Wait before checking again
        await this.sleep(100);
      }
    }

    this.processing = false;
  }

  /**
   * Get current queue length
   * @returns {number} Number of requests waiting in queue
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Get current rate limiter stats
   * @returns {Object} Current stats
   */
  getStats() {
    return {
      availableTokens: this.tokens,
      queueLength: this.queue.length,
      totalRequests: this.requestCount,
      currentBackoff: this.currentBackoff,
      consecutiveFailures: this.consecutiveFailures
    };
  }

  /**
   * Report a failed request (for backoff calculation)
   */
  reportFailure() {
    this.consecutiveFailures++;
    this.currentBackoff = Math.min(
      this.maxBackoff,
      this.currentBackoff * this.backoffMultiplier
    );
  }

  /**
   * Get current backoff duration
   * @returns {number} Backoff duration in milliseconds
   */
  getBackoffDuration() {
    return this.currentBackoff;
  }

  /**
   * Wait with exponential backoff
   * @returns {Promise<void>}
   */
  async waitWithBackoff() {
    const backoffDuration = this.getBackoffDuration();
    await this.sleep(backoffDuration);
    this.reportFailure(); // Increase backoff for next time
  }

  /**
   * Reset backoff to minimum
   */
  resetBackoff() {
    this.consecutiveFailures = 0;
    this.currentBackoff = this.minBackoff;
  }

  /**
   * Sleep utility
   * @param {number} ms Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clearQueue() {
    // Reject all pending requests
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      request.resolve(); // Resolve to prevent hanging promises
    }
  }

  /**
   * Reset rate limiter state
   */
  reset() {
    this.tokens = this.maxTokens;
    this.requestCount = 0;
    this.lastRefillTime = Date.now();
    this.consecutiveFailures = 0;
    this.currentBackoff = this.minBackoff;
    this.clearQueue();
  }
}

// Create a singleton instance for Azure API rate limiting
const azureRateLimiter = new RateLimiter({
  maxTokens: tierConfig.maxTokens,
  refillRate: tierConfig.refillRate,
  minBackoff: 100,
  maxBackoff: 60000,
  backoffMultiplier: 2
});

// Export functions for easy use
export const rateLimiter = azureRateLimiter;

// Export tier configuration for use in other modules
export const getTierConfig = () => tierConfig;
export const getMaxConcurrent = () => tierConfig.maxConcurrent;

// Convenience functions
export const canMakeRequest = () => azureRateLimiter.canMakeRequest();
export const waitForToken = () => azureRateLimiter.waitForToken();
export const getQueueLength = () => azureRateLimiter.getQueueLength();
export const getStats = () => azureRateLimiter.getStats();
export const reportFailure = () => azureRateLimiter.reportFailure();
export const waitWithBackoff = () => azureRateLimiter.waitWithBackoff();
export const resetBackoff = () => azureRateLimiter.resetBackoff();
export const reset = () => azureRateLimiter.reset();

// Export class for custom instances
export { RateLimiter };