/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
var _ = require('lodash');

var browsers = require('./browsers');
var sauce    = require('./sauce');

/** WCT plugin that enables support for remote browsers via Sauce Labs. */
module.exports = function(wct, pluginOptions) {

  // The capabilities objects for browsers to run. We don't know the tunnel id
  // until `prepare`, so we've gotta hang onto them.
  var eachCapabilities = [];

  wct.hook('configure', function(done) {
    if (!pluginOptions.browsers || pluginOptions.browsers.length === 0) return done();

    expandOptions(pluginOptions);

    browsers.expand(pluginOptions, function(error, expanded) {
      if (error) return done(error);
      wct.emit('log:debug', 'Using sauce browsers:', expanded);
      // We are careful to append these to the configuration object, even though
      // we don't know the tunnel id yet. This allows WCT to give a useful error
      // if no browsers were configured.
      var activeBrowsers = wct.options.activeBrowsers;
      activeBrowsers.push.apply(activeBrowsers, expanded);
      // But we still need to inject the sauce tunnel ID once we know it.
      eachCapabilities = expanded;

      done();
    });
  });

  wct.hook('prepare', function(done) {
    // Don't bother spinning up the tunnel if we don't have any browsers talking
    // over it.
    if (eachCapabilities.length === 0) return done();

    // Is there already an active sauce tunnel?
    if (pluginOptions.tunnelId) {
      _injectTunnelId(eachCapabilities, pluginOptions.tunnelId);
      return done();
    }

    // Let anyone know, and give them a chance to modify the options prior to
    // booting up the Sauce Connect tunnel.
    wct.emitHook('prepare:sauce-tunnel', function(error) {
      if (error) return done(error);
      sauce.startTunnel(pluginOptions, wct, function(error, tunnelId) {
        if (error) return done(error);
        _injectTunnelId(eachCapabilities, tunnelId);
        done();
      });
    });
  });

};

function expandOptions(options) {
  _.defaults(options, {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    tunnelId:  process.env.SAUCE_TUNNEL_ID,
  });
}

/**
 * @param {!Array<!Object>} eachCapabilities
 * @param {string} tunnelId
 */
function _injectTunnelId(eachCapabilities, tunnelId) {
  eachCapabilities.forEach(function(browser) {
    browser['tunnel-identifier'] = tunnelId;
  });
}

// Hacks for the wct-st binary.
module.exports.expandOptions = expandOptions;
module.exports.startTunnel   = sauce.startTunnel;
