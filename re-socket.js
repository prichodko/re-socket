import EventEmitter from 'component-emitter'
import backoff from 'es-backoff'

const readyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}

export default class ReSocket extends EventEmitter {
  constructor({
    url,
    WebSocketCtor,
    minDelay = 1000,
    maxDelay = 5000,
    maxAttempts = Infinity,
    useMessageBuffer = true,
    autoConnect = true
  }) {
    super()
    this.url = url
    this.WebSocketCtor = WebSocketCtor
    this.backoff = backoff({ min: minDelay, maxDelay: maxDelay })
    this.maxAttempts = maxAttempts
    this.useMessageBuffer = useMessageBuffer
    this.messageBuffer = []
    this.readyState = 'closed'
    this.reconnecting = false
    this.closing = false
    if (autoConnect) {
      this.connect()
    }
  }

  open(onopen, onerror) {
    if (this.readyState === 'open') {
      return
    }
    const { url, WebSocketCtor } = this
    this.ws = new WebSocketCtor(url)
    this.readyState = 'opening'
    this.ws.onopen = () => {
      this.readyState = 'open'
      onopen()
    }
    this.ws.onerror = err => {
      this.readyState = 'closed'
      onerror(err)
    }
  }

  connect() {
    this.open(
      () => this.onopen(),
      err => {
        console.log(err)
        if (!this.reconnecting && this.backoff.attempts === 0) {
          this.reconnect()
        }
      }
    )
  }

  reconnect() {
    const { attempts } = this.backoff
    if (attempts > this.maxAttempts) {
      console.log('too many attempts')
    } else {
      const delay = this.backoff.delay()
      this.reconnecting = true
      const timeout = setTimeout(function() {
        this.open(
          () => this.onreconnect(),
          err => {
            console.log(err)
            this.reconnecting = false
            this.reconnect()
          }
        )
      }, delay)
      // This.subs.push({ off: () => clearTimeout(timeout)})
    }
  }

  onopen() {
    this.ws.onmessage = message => this.emit('message', message)
    this.ws.onclose = () => this.onclose()
    this.ws.onerror = err => this.onerror(err)
  }

  onreconnect() {
    const { attempts } = this.backoff
    this.reconnecting = false
    this.backoff.reset()
    this.ws.onmessage = message => this.emit('message', message)
    this.ws.onclose = () => this.onclose()
    this.ws.onerror = err => this.onerror(err)
  }

  onclose() {
    this.readyState = 'closed'
    this.backoff.reset()
    // This.cleanup()
    if (!this.closing) {
      this.reconnect()
    }
  }

  onerror(err) {
    console.log(err)
  }

  send(message) {
    if (this.ws.readyState === readyState.OPEN) {
      return this.ws.send(message)
    }
    if (this.useMessageBuffer) {
      return this.messageBuffer.push(message)
    }
  }

  close() {
    this.closing = true
    if (this.ws) {
      this.ws.close()
    }
  }

  // Clean() {
  //   this.subs.forEach(sub => sub.off())
  // }
}
