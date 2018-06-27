'use strict'

const { WrkApi } = require('bfx-wrk-api')
const async = require('async')
const bullProcessor = require('./loc.api/bull/bull.processor')
const bullAggregator = require('./loc.api/bull/bull.aggregator')

class WrkReportServiceApi extends WrkApi {
  constructor (conf, ctx) {
    super(conf, ctx)

    this.loadConf('service.report', 'report')

    this.init()
    this.start()
  }

  getApiConf () {
    return {
      path: 'service.report'
    }
  }

  getPluginCtx (type) {
    super.init()

    const ctx = super.getPluginCtx(type)

    switch (type) {
      case 'api_bfx':
        ctx.bull_processor = this.bull_processor
        ctx.bull_aggregator = this.bull_aggregator
        break
    }

    return ctx
  }

  init () {
    super.init()

    this.setInitFacs([
      [
        'fac',
        'bfx-facs-bull',
        'processor',
        'processor',
        () => this.getBullProcConf()
      ],
      [
        'fac',
        'bfx-facs-bull',
        'aggregator',
        'aggregator',
        () => this.getBullAggrConf()
      ]
    ])
  }

  getBullProcConf () {
    const group = this.group
    const conf = this.conf[group]

    if (
      conf &&
      typeof conf.bull === 'object' &&
      conf.bull.processor &&
      conf.bull.processor.queue
    ) {
      return {
        port: conf.bull.port,
        host: conf.bull.host,
        auth: conf.bull.auth,
        queue: conf.bull.processor.queue
      }
    }

    return null
  }

  getBullAggrConf () {
    const group = this.group
    const conf = this.conf[group]

    if (
      conf &&
      typeof conf.bull === 'object' &&
      conf.bull.aggregator &&
      conf.bull.aggregator.queue
    ) {
      return {
        port: conf.bull.port,
        host: conf.bull.host,
        auth: conf.bull.auth,
        queue: conf.bull.aggregator.queue
      }
    }

    return null
  }

  _start (cb) {
    async.series([ next => { super._start(next) },
      next => {
        const reportService = this.grc_bfx.api
        const processorQueue = this.bull_processor.queue
        const aggregatorQueue = this.bull_aggregator.queue

        bullProcessor.setReportService(reportService)
        bullAggregator.setReportService(reportService)

        processorQueue.process(bullProcessor)
        aggregatorQueue.process(bullAggregator)

        processorQueue.on('completed', (job, result) => {
          aggregatorQueue.add(result)
        })

        next()
      }
    ], cb)
  }
}

module.exports = WrkReportServiceApi
