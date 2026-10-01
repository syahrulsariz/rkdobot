class Queue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  add(task) {
    this.queue.push(task);
    console.log(`📥 Task ditambahkan ke queue. Total: ${this.queue.length}`);
    
    if (!this.isProcessing) {
      this.process();
    }
  }

  async process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      console.log('✅ Queue kosong, menunggu task baru...');
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    
    console.log(`⚙️ Memproses task... Sisa queue: ${this.queue.length}`);
    
    try {
      await task();
    } catch (error) {
      console.error('❌ Error saat memproses task:', error);
    }
    
    // Proses task berikutnya
    await this.process();
  }
}

export default new Queue();
