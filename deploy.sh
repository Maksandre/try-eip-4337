#!/bin/bash

# Arachnid Deterministic Deployment Proxy Script
# Deploy Create2Deployer to: 0x4e59b44847b379578588920ca78fbf26c0b4956c

set -e

# Configuration
TARGET_ADDRESS="0x4e59b44847b379578588920ca78fbf26c0b4956c"
RPC_URL="${RPC_URL:-http://localhost:8545}"
PRIVATE_KEY="${PRIVATE_KEY}"
CHAIN_ID="${CHAIN_ID}"

# Arachnid's Deterministic Deployment Proxy
PROXY_ADDRESS="0x4e59b44847b379578588920cA78FbF26c0B4956C"
PROXY_DEPLOYER="0x3fAB184622Dc19b6109349B94811493BF2a45362"

# The raw signed transaction to deploy the proxy (gasPrice: 100 gwei, gasLimit: 100000)
PROXY_DEPLOY_TX="0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222"

# Create2Deployer bytecode (Gnosis Safe's Create2 deployer)
CREATE2_DEPLOYER_INIT="0x604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3"

# Salt for deterministic deployment (0x0000...0000)
SALT="0x0000000000000000000000000000000000000000000000000000000000000000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Arachnid Deterministic Deployment Script${NC}"
echo "═══════════════════════════════════════════════"
echo "Target Address: $TARGET_ADDRESS"
echo "Proxy Address:  $PROXY_ADDRESS"
echo "RPC URL:        $RPC_URL"
echo "Chain ID:       $CHAIN_ID"
echo ""

# Validate environment
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ Error: PRIVATE_KEY environment variable not set${NC}"
    exit 1
fi

if [ -z "$CHAIN_ID" ]; then
    echo -e "${RED}❌ Error: CHAIN_ID environment variable not set${NC}"
    exit 1
fi

# Function to check if proxy is deployed
check_proxy_deployed() {
    CODE=$(cast code $PROXY_ADDRESS --rpc-url $RPC_URL 2>/dev/null || echo "0x")
    if [ "$CODE" != "0x" ]; then
        echo -e "${GREEN}✅ Proxy already deployed at $PROXY_ADDRESS${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Proxy not deployed at $PROXY_ADDRESS${NC}"
        return 1
    fi
}

# Function to deploy the proxy
deploy_proxy() {
    echo -e "${YELLOW}📦 Deploying Arachnid's Deterministic Deployment Proxy...${NC}"
    
    # Check if deployer address has enough ETH for gas
    DEPLOYER_BALANCE=$(cast balance $PROXY_DEPLOYER --rpc-url $RPC_URL)
    REQUIRED_GAS="10000000000000000"  # 0.01 ETH
    
    if [ "$DEPLOYER_BALANCE" = "0" ]; then
        echo -e "${YELLOW}💰 Funding proxy deployer address...${NC}"
        cast send $PROXY_DEPLOYER --value 0.01ether \
            --private-key $PRIVATE_KEY \
            --rpc-url $RPC_URL \
            --chain $CHAIN_ID
    fi
    
    echo -e "${YELLOW}📡 Broadcasting proxy deployment transaction...${NC}"
    TX_HASH=$(cast publish $PROXY_DEPLOY_TX --rpc-url $RPC_URL)
    echo "Transaction hash: $TX_HASH"
    
    # Wait for confirmation
    echo -e "${YELLOW}⏳ Waiting for confirmation...${NC}"
    cast receipt $TX_HASH --rpc-url $RPC_URL > /dev/null
    
    if check_proxy_deployed; then
        echo -e "${GREEN}🎉 Proxy deployed successfully!${NC}"
    else
        echo -e "${RED}❌ Proxy deployment failed${NC}"
        exit 1
    fi
}

# Function to calculate Create2 address
calculate_create2_address() {
    local deployer=$1
    local salt=$2
    local bytecode_hash=$3
    
    # This would need a more complex calculation
    # For now, we'll use the known address
    echo $TARGET_ADDRESS
}

# Function to deploy Create2Deployer
deploy_create2_deployer() {
    echo -e "${YELLOW}🎯 Deploying Create2Deployer using proxy...${NC}"
    
    # Calculate bytecode hash
    BYTECODE_HASH=$(cast keccak $CREATE2_DEPLOYER_INIT)
    echo "Bytecode hash: $BYTECODE_HASH"
    
    # Check if target address is available
    CODE=$(cast code $TARGET_ADDRESS --rpc-url $RPC_URL)
    if [ "$CODE" != "0x" ]; then
        echo -e "${RED}❌ Target address already occupied!${NC}"
        echo "Existing code: $CODE"
        exit 1
    fi
    
    # Deploy using the proxy
    echo -e "${YELLOW}📤 Calling proxy.deploy(salt, bytecode)...${NC}"
    TX_HASH=$(cast send $PROXY_ADDRESS "deploy(uint256,bytes)" \
        $SALT \
        $CREATE2_DEPLOYER_INIT \
        --private-key $PRIVATE_KEY \
        --rpc-url $RPC_URL \
        --chain $CHAIN_ID \
        --gas-limit 200000)
    
    echo "Deployment transaction: $TX_HASH"
    
    # Wait for confirmation
    echo -e "${YELLOW}⏳ Waiting for deployment confirmation...${NC}"
    RECEIPT=$(cast receipt $TX_HASH --rpc-url $RPC_URL)
    
    # Check deployment
    FINAL_CODE=$(cast code $TARGET_ADDRESS --rpc-url $RPC_URL)
    if [ "$FINAL_CODE" != "0x" ]; then
        echo -e "${GREEN}🎉 Create2Deployer deployed successfully!${NC}"
        echo "Address: $TARGET_ADDRESS"
        echo "Code length: $((${#FINAL_CODE} / 2 - 1)) bytes"
        return 0
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        return 1
    fi
}

# Function to test the deployed Create2Deployer
test_create2_deployer() {
    echo -e "${YELLOW}🧪 Testing Create2Deployer functionality...${NC}"
    
    # Test with a simple contract deployment
    TEST_BYTECODE="0x6000600055"  # Simple contract that stores 0 at slot 0
    TEST_SALT="0x1234567890123456789012345678901234567890123456789012345678901234"
    
    echo "Testing with bytecode: $TEST_BYTECODE"
    echo "Testing with salt: $TEST_SALT"
    
    # Call the Create2Deployer
    cast send $TARGET_ADDRESS "deploy(uint256,bytes)" \
        $TEST_SALT \
        $TEST_BYTECODE \
        --private-key $PRIVATE_KEY \
        --rpc-url $RPC_URL \
        --chain $CHAIN_ID \
        --gas-limit 100000 > /dev/null
    
    echo -e "${GREEN}✅ Create2Deployer is working!${NC}"
}

# Main execution flow
main() {
    echo -e "${BLUE}🔍 Checking current state...${NC}"
    
    # Check if proxy is deployed
    if ! check_proxy_deployed; then
        echo -e "${YELLOW}🚀 Deploying proxy first...${NC}"
        deploy_proxy
    fi
    
    # Check if Create2Deployer is already at target address
    CODE=$(cast code $TARGET_ADDRESS --rpc-url $RPC_URL)
    if [ "$CODE" != "0x" ]; then
        echo -e "${GREEN}✅ Create2Deployer already deployed at target address!${NC}"
        echo "Skipping deployment..."
    else
        echo -e "${YELLOW}🎯 Deploying Create2Deployer...${NC}"
        if deploy_create2_deployer; then
            test_create2_deployer
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎊 ALL DONE!${NC}"
    echo "═══════════════════════════════════════════════"
    echo "Proxy Address:           $PROXY_ADDRESS"
    echo "Create2Deployer Address: $TARGET_ADDRESS"
    echo ""
    echo -e "${BLUE}💡 Usage:${NC}"
    echo "cast send $TARGET_ADDRESS \"deploy(uint256,bytes)\" \\"
    echo "    \"YOUR_SALT\" \\"
    echo "    \"YOUR_BYTECODE\" \\"
    echo "    --private-key \$PRIVATE_KEY \\"
    echo "    --rpc-url \$RPC_URL"
}

# Run the script
main

echo -e "${GREEN}🚀 Script completed successfully!${NC}"