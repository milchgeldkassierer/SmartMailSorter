# Ollama Setup Guide

**Run SmartMailSorter's AI email categorization completely offline with zero API costs and maximum privacy.**

## Overview

SmartMailSorter supports **Ollama** as a local AI provider, enabling fully offline email categorization that runs entirely on your computer. Unlike cloud providers (Google Gemini, OpenAI, Anthropic Claude), Ollama models process your emails locally with **zero data leaving your device** and **no ongoing API costs**.

### Why Use Ollama?

- **🔒 Maximum Privacy**: Email content never leaves your computer — AI processing happens 100% locally
- **💰 Zero API Costs**: No subscription fees, API charges, or usage limits
- **🌐 Fully Offline**: Works without internet connection after initial model download
- **🎛️ Full Control**: Choose your model, performance profile, and resource usage
- **📊 Transparency**: Inspect model behavior and categorization logic completely

### Trade-offs

- **Hardware Required**: Needs at least 8GB RAM (16GB recommended) and modern CPU
- **Initial Setup**: Requires installing Ollama and downloading AI models (~2-8GB per model)
- **Performance**: Categorization takes 2-10 seconds locally vs. <2s for cloud APIs
- **Model Quality**: Smaller local models may be less accurate than large cloud models for edge cases

## Minimum Ollama Version

SmartMailSorter requires **Ollama 0.5.0 or later**. The structured JSON output feature (`format: json_schema`) used for reliable email categorization was introduced in Ollama 0.5.0. Earlier versions will fail with format errors.

```bash
# Check your version
ollama --version

# Update if needed (Linux)
curl -fsSL https://ollama.com/install.sh | sh
```

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended | Optimal |
|-----------|---------|-------------|---------|
| **RAM** | 8GB | 16GB | 32GB |
| **CPU** | 4 cores | 6+ cores | 8+ cores |
| **Storage** | 10GB free | 20GB free | 50GB free |
| **GPU** | Not required | NVIDIA/AMD GPU | NVIDIA GPU with 8GB+ VRAM |

**Notes:**
- **RAM**: Required to load model weights into memory during categorization
- **Storage**: Each model requires 2-8GB depending on parameter count
- **GPU**: Optional but significantly improves performance (2-5x faster)
- **CPU**: Multi-core performance matters more than single-core speed

### Supported Operating Systems

- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch, etc.
- **macOS**: macOS 11 (Big Sur) or later (Apple Silicon and Intel)
- **Windows**: Windows 10/11 with WSL2 (Windows Subsystem for Linux)

## Installation

### Step 1: Install Ollama

#### Linux

```bash
# Download and install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

#### macOS

```bash
# Download installer from ollama.com or use Homebrew
brew install ollama

# Verify installation
ollama --version
```

Alternatively, download the `.dmg` installer from [ollama.com/download](https://ollama.com/download).

#### Windows

1. Install **WSL2** (Windows Subsystem for Linux) if not already installed:

   ```powershell
   wsl --install
   ```

2. Open WSL2 terminal and install Ollama:

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

### Step 2: Start Ollama Service

Ollama runs as a background service on `http://localhost:11434`.

#### Linux / macOS

```bash
# Start Ollama service (runs in background)
ollama serve
```

**Auto-start on boot (optional):**

```bash
# Create systemd service (Linux)
sudo systemctl enable ollama
sudo systemctl start ollama

# Verify service status
sudo systemctl status ollama
```

On macOS, Ollama automatically starts on login after installation.

#### Windows (WSL2)

```bash
# In WSL2 terminal
ollama serve
```

Keep this terminal open, or configure auto-start in WSL2.

### Step 3: Download AI Models

Pull one or more models for email categorization. **Recommended models** for SmartMailSorter:

| Model | Size | RAM Required | Speed | Accuracy | Best For |
|-------|------|--------------|-------|----------|----------|
| **phi3** | 2.3GB | 6GB | ⚡ Fast (2-5s) | Good | Resource-constrained systems |
| **mistral** | 4.1GB | 8GB | ⚡ Fast (3-7s) | Very Good | Balanced performance |
| **llama3** | 4.7GB | 10GB | Medium (3-8s) | Excellent | High accuracy |
| **gemma2** | 5.4GB | 12GB | Medium (4-9s) | Excellent | Latest Google model |

#### Download Models

```bash
# Recommended: Start with Mistral (good balance)
ollama pull mistral

# Alternative: Phi-3 (fastest, smallest)
ollama pull phi3

# Alternative: Llama 3 (best accuracy)
ollama pull llama3

# Alternative: Gemma 2 (latest from Google)
ollama pull gemma2
```

**First-time download** may take 5-15 minutes depending on internet speed (models are 2-8GB).

#### Verify Models

```bash
# List installed models
ollama list

# Expected output:
# NAME            ID              SIZE    MODIFIED
# mistral:latest  abc123def456    4.1GB   2 minutes ago
# phi3:latest     def789ghi012    2.3GB   5 minutes ago
```

### Step 4: Test Ollama

```bash
# Quick test with a simple query
ollama run mistral "Classify this email: Subject: Invoice #12345 from Amazon"

# Expected response: Should recognize invoice/commerce category
```

If this works, Ollama is ready for SmartMailSorter!

## SmartMailSorter Configuration

### Step 1: Select Ollama Provider

1. **Open SmartMailSorter**
2. Navigate to **Settings** → **Smart Sort** tab
3. Under **AI Provider**, select **"Ollama"** from dropdown
4. Verify **green checkmark ✓** appears with message: _"Ollama connected"_

**Troubleshooting:**
- **Red X ❌ "Ollama not reachable"**: Ollama service is not running → Run `ollama serve`
- **Spinner 🔵 "Detecting Ollama..."**: Check takes >5 seconds → Check firewall/network

### Step 2: Select Model

1. After selecting Ollama provider, the **Model** dropdown will populate with installed models
2. Select your preferred model (e.g., `mistral:latest`, `llama3:latest`, `phi3:latest`)
3. If no models appear, verify models are installed: `ollama list`

**Note:** The model dropdown shows:
- **Installed models** (fetched from Ollama API) if Ollama is running
- **Default models** (llama3, mistral, phi3, gemma2) if Ollama is unavailable

### Step 3: Verify Settings

1. Notice **"No API key required - runs locally"** message (API key field is hidden for Ollama)
2. Click **"Save AI Settings"**
3. Settings are persisted even if Ollama is temporarily unavailable

### Step 4: Test Categorization

1. Navigate to **Email List**
2. Select one or more emails
3. Click **"Smart Sort"** button in batch action bar
4. Wait 2-10 seconds for categorization to complete (depends on model and hardware)
5. Verify emails are categorized correctly (Inbox, Invoice, Newsletter, Private, etc.)

## Performance Optimization

### Choosing the Right Model

**For resource-constrained systems (8GB RAM, older CPUs):**
- Use `phi3` — Fastest and smallest model
- Expect 2-5 second categorization time
- Good accuracy for common email types

**For balanced performance (16GB RAM, modern CPUs):**
- Use `mistral` — Best speed/accuracy balance
- Expect 3-7 second categorization time
- Very good accuracy across email types

**For maximum accuracy (16GB+ RAM, powerful CPUs):**
- Use `llama3` or `gemma2` — Highest accuracy
- Expect 3-9 second categorization time
- Excellent accuracy including edge cases

### GPU Acceleration

If you have an **NVIDIA GPU**, Ollama automatically uses it for 2-5x faster inference:

```bash
# Verify GPU is detected
ollama run mistral "test"

# Check nvidia-smi to confirm GPU usage
nvidia-smi
```

**GPU recommendations:**
- **8GB VRAM**: Can run llama3, mistral, gemma2 at full speed
- **4GB VRAM**: Can run phi3, smaller variants
- **No GPU**: CPU-only is still functional (slower)

### Batch Processing

For **bulk categorization** (100+ emails):
- **Smaller models** (phi3, mistral) process faster in aggregate
- **Larger models** (llama3, gemma2) maintain accuracy better across diverse emails
- SmartMailSorter batches emails automatically to optimize performance

## Troubleshooting

### Issue: "Ollama not reachable" Error

**Symptoms:**
- Red X ❌ appears in Settings → Smart Sort tab
- Cannot select models
- Categorization fails with connection error

**Solutions:**

1. **Verify Ollama is running:**

   ```bash
   # Check if Ollama service is running
   curl http://localhost:11434/api/tags

   # If error, start Ollama
   ollama serve
   ```

2. **Check port availability:**

   ```bash
   # Verify port 11434 is open
   lsof -i :11434   # Linux/macOS
   netstat -an | grep 11434   # Windows
   ```

3. **Firewall settings:**
   - Ensure `localhost` connections are allowed
   - On Linux: `sudo ufw allow 11434/tcp` (if using ufw)

4. **Restart Ollama service:**

   ```bash
   # Stop Ollama
   pkill ollama

   # Start Ollama
   ollama serve
   ```

### Issue: Categorization is Very Slow (>15 seconds)

**Symptoms:**
- Email categorization takes >15 seconds per email
- UI freezes or shows loading spinner for extended time

**Solutions:**

1. **Switch to smaller model:**

   ```bash
   # Pull and use phi3 (fastest)
   ollama pull phi3
   ```

   Then select `phi3:latest` in SmartMailSorter settings.

2. **Check system resources:**

   ```bash
   # Monitor CPU/RAM usage during categorization
   htop   # or top on macOS/Linux

   # Close other memory-intensive applications
   ```

3. **Verify GPU is being used (if available):**

   ```bash
   # Run during categorization
   nvidia-smi   # Should show Ollama process using GPU

   # If not using GPU, reinstall Ollama with CUDA support
   ```

4. **Upgrade hardware:**
   - Add more RAM (16GB+ recommended)
   - Use faster SSD for model storage
   - Consider GPU acceleration

### Issue: Model Not Appearing in Dropdown

**Symptoms:**
- Model installed via `ollama pull` but not visible in SmartMailSorter

**Solutions:**

1. **Refresh model list:**
   - Switch to different provider, then back to Ollama
   - Restart SmartMailSorter

2. **Verify model is installed:**

   ```bash
   ollama list
   # Should show model in list
   ```

3. **Check model name format:**
   - SmartMailSorter expects format: `modelname:tag` (e.g., `mistral:latest`)
   - Custom tags are supported: `llama3:7b-instruct`

4. **Manual selection:**
   - If model is installed but not appearing, you can still type it manually in the model field

### Issue: Low Categorization Accuracy

**Symptoms:**
- Emails are frequently miscategorized
- Invoices marked as Newsletter, etc.

**Solutions:**

1. **Upgrade to larger model:**

   ```bash
   # Switch from phi3 → mistral or llama3
   ollama pull llama3
   ```

2. **Provide feedback:**
   - Manually recategorize emails in SmartMailSorter
   - Future versions will support fine-tuning based on corrections

3. **Check email content:**
   - Very short emails (<50 chars) may lack context for accurate categorization
   - Emails in non-English languages may perform worse depending on model

4. **Try different model:**
   - Different models have different strengths
   - Test: `phi3`, `mistral`, `llama3`, `gemma2` and compare accuracy

### Issue: Out of Memory Errors

**Symptoms:**
- Ollama crashes with OOM (out of memory) error
- System freezes during categorization

**Solutions:**

1. **Switch to smaller model:**

   ```bash
   # Use phi3 (2.3GB) instead of llama3 (4.7GB)
   ollama pull phi3
   ```

2. **Close other applications:**
   - Free up RAM before running categorization
   - Close browser tabs, IDEs, etc.

3. **Increase system swap:**

   ```bash
   # Linux: Add swap space
   sudo fallocate -l 8G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Upgrade RAM:**
   - 16GB+ recommended for comfortable use
   - 32GB ideal for running large models

## Advanced Configuration

### Custom Model Variants

Ollama supports many model variants and sizes:

```bash
# Llama 3 variants
ollama pull llama3:8b        # 8 billion parameters (default)
ollama pull llama3:70b       # 70 billion parameters (requires 48GB+ RAM)

# Mistral variants
ollama pull mistral:7b       # 7 billion parameters
ollama pull mistral:instruct # Instruction-tuned variant

# Custom quantized models (smaller, faster)
ollama pull llama3:8b-q4_0   # 4-bit quantization (2.3GB instead of 4.7GB)
```

Select custom variants in SmartMailSorter's model dropdown after pulling.

### Running Multiple Models

You can have multiple models installed and switch between them:

```bash
# Install multiple models
ollama pull phi3
ollama pull mistral
ollama pull llama3

# Switch in SmartMailSorter settings as needed
```

**Use case:**
- `phi3` for quick daily categorization
- `llama3` for monthly bulk processing (higher accuracy)

### Model Management

```bash
# List all installed models
ollama list

# Remove unused models to free storage
ollama rm llama3:70b

# Update model to latest version
ollama pull mistral
```

### Ollama Configuration

Edit Ollama's environment variables to customize behavior:

```bash
# Linux/macOS: Set in ~/.bashrc or ~/.zshrc
export OLLAMA_HOST="127.0.0.1:11434"   # Change port
export OLLAMA_MODELS="/path/to/models" # Custom model storage location
export OLLAMA_NUM_GPU=1                 # Limit GPU usage

# Then restart Ollama
ollama serve
```

## Comparison: Ollama vs. Cloud Providers

| Aspect | Ollama (Local) | Google Gemini | OpenAI | Anthropic Claude |
|--------|----------------|---------------|--------|------------------|
| **Privacy** | 🟢 100% local | 🔴 Cloud API | 🔴 Cloud API | 🔴 Cloud API |
| **Cost** | 🟢 Free | 🟡 Pay-per-use | 🟡 Pay-per-use | 🟡 Pay-per-use |
| **Speed** | 🟡 2-10s | 🟢 <2s | 🟢 <2s | 🟢 <2s |
| **Offline** | 🟢 Yes | 🔴 No | 🔴 No | 🔴 No |
| **Accuracy** | 🟡 Good-Excellent | 🟢 Excellent | 🟢 Excellent | 🟢 Excellent |
| **Setup** | 🟡 Moderate | 🟢 Easy (API key) | 🟢 Easy (API key) | 🟢 Easy (API key) |
| **Hardware** | 🔴 8GB+ RAM | 🟢 None | 🟢 None | 🟢 None |

**When to choose Ollama:**
- Maximum privacy is non-negotiable
- No internet connection available
- Want to avoid ongoing API costs
- Have sufficient hardware resources

**When to choose cloud providers:**
- Need fastest categorization (<2s)
- Limited hardware (4GB RAM laptops, etc.)
- Want highest accuracy for edge cases
- Prefer zero-setup convenience

## Privacy & Security

### Data Flow with Ollama

When using Ollama, your email data **never leaves your computer**:

1. Email synced via IMAP → Stored in local SQLite database
2. User triggers categorization → SmartMailSorter sends email to `localhost:11434`
3. Ollama processes locally → Returns category
4. Category saved to local database

**Zero external connections:** No data sent to Google, OpenAI, Anthropic, or any third party.

### Security Considerations

- **Localhost-only**: Ollama listens on `127.0.0.1` by default (not accessible from network)
- **No authentication**: Ollama assumes localhost connections are trusted
- **Model integrity**: Download models only from official Ollama repository
- **Disk encryption**: Consider encrypting model storage directory for maximum security

### Recommended Security Setup

```bash
# 1. Verify Ollama is localhost-only
netstat -an | grep 11434
# Should show: 127.0.0.1:11434 (NOT 0.0.0.0:11434)

# 2. Use firewall to block external access
sudo ufw deny 11434/tcp   # Linux
# or configure macOS/Windows firewall

# 3. Encrypt model storage (optional)
# Use LUKS (Linux), FileVault (macOS), or BitLocker (Windows)
```

## Frequently Asked Questions

### Can I use Ollama without internet?

**Yes!** After initial setup (downloading Ollama and models), everything runs 100% offline. You'll still need internet for IMAP email syncing, but AI categorization works without any connection.

### Which model should I use?

- **Starting out?** Use `mistral` — Best balance of speed and accuracy
- **Limited RAM?** Use `phi3` — Smallest and fastest
- **Best accuracy?** Use `llama3` — Highest quality categorization

### Can I use Ollama with GPU acceleration?

**Yes!** Ollama automatically detects and uses NVIDIA GPUs (CUDA) and AMD GPUs (ROCm). This provides 2-5x faster categorization. No configuration needed — just install GPU drivers and Ollama will use it.

### How much faster is GPU vs. CPU?

Typical speedup with GPU:
- **phi3**: 2-3s (CPU) → 1s (GPU)
- **mistral**: 5-7s (CPU) → 2-3s (GPU)
- **llama3**: 6-9s (CPU) → 2-4s (GPU)

### Does Ollama support languages other than English?

**Yes!** Models like `llama3` and `mistral` support multilingual email categorization:
- German (Deutsch)
- Spanish (Español)
- French (Français)
- Italian (Italiano)
- Portuguese (Português)
- And many more

SmartMailSorter's i18n system works seamlessly with Ollama for non-English emails.

### Can I fine-tune models for better accuracy?

**Not yet in SmartMailSorter**, but Ollama supports custom fine-tuned models. Future versions may support:
- Training on your email history
- Custom category definitions
- User feedback incorporation

For now, you can manually recategorize emails to improve your personal workflow.

### How do I update models?

```bash
# Pull latest version of a model
ollama pull mistral

# Ollama will download updated weights if available
# SmartMailSorter will automatically use the new version
```

### Can I run Ollama on a server and access from SmartMailSorter?

**Not officially supported**, but technically possible:

```bash
# On server: Configure Ollama to listen on network
export OLLAMA_HOST="0.0.0.0:11434"
ollama serve

# WARNING: This exposes Ollama to network — use firewall/VPN
```

Then modify SmartMailSorter code to point to `http://server-ip:11434` instead of `localhost`. **Security risk:** Only do this on trusted networks with proper firewall rules.

### Is Ollama supported on ARM processors (Apple Silicon, Raspberry Pi)?

**Yes!**
- **Apple Silicon (M1/M2/M3)**: Fully supported, excellent performance
- **Raspberry Pi**: Supported, but needs at least 8GB RAM model
- **ARM servers**: Supported (e.g., AWS Graviton, Ampere)

### What happens if Ollama crashes during categorization?

SmartMailSorter handles Ollama failures gracefully:
- Shows error message: "Ollama API error (connection refused)"
- Email remains uncategorized (can retry later)
- No data loss or corruption
- Can switch to cloud provider temporarily

## Additional Resources

### Official Documentation

- **Ollama Official Site**: [ollama.com](https://ollama.com)
- **Ollama GitHub**: [github.com/ollama/ollama](https://github.com/ollama/ollama)
- **Model Library**: [ollama.com/library](https://ollama.com/library)

### SmartMailSorter Resources

- **Main README**: [README.md](../README.md) — Overview and features
- **Translation Guide**: [TRANSLATION_GUIDE.md](./TRANSLATION_GUIDE.md) — Contribute translations
- **Issue Tracker**: Report Ollama-specific bugs on GitHub Issues

### Community

- **Discussions**: SmartMailSorter GitHub Discussions for Ollama tips and troubleshooting
- **Ollama Discord**: Join Ollama community for model recommendations

## Support

### Getting Help

1. **Check this guide** for common issues and solutions
2. **Search GitHub Issues** for existing Ollama-related problems
3. **Open new issue** with details:
   - Ollama version: `ollama --version`
   - SmartMailSorter version
   - Model used
   - Error messages
   - System specs (RAM, CPU, GPU)

### Reporting Bugs

When reporting Ollama integration bugs, include:

```bash
# Ollama version
ollama --version

# Installed models
ollama list

# Test Ollama directly
ollama run mistral "Categorize: Invoice from Amazon"

# Check SmartMailSorter logs
# (in Electron DevTools Console)
```

---

**Enjoy private, offline, cost-free AI email categorization with Ollama!** 🎉
