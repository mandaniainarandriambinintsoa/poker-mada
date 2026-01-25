/**
 * Configuration PM2 pour Poker Mada Server
 *
 * Pour déployer en production:
 * 1. npm run build
 * 2. pm2 start ecosystem.config.js --env production
 *
 * Commandes utiles:
 * - pm2 status            : Voir le statut des processus
 * - pm2 logs poker-mada   : Voir les logs
 * - pm2 restart poker-mada: Redémarrer
 * - pm2 reload poker-mada : Redémarrer sans downtime (zero-downtime)
 * - pm2 stop poker-mada   : Arrêter
 * - pm2 monit             : Monitoring en temps réel
 */

module.exports = {
  apps: [
    {
      name: 'poker-mada',
      script: 'dist/app.js',

      // Mode cluster pour utiliser tous les CPU
      // Note: Socket.io nécessite sticky sessions ou Redis adapter
      // Pour une seule instance sur Render, utiliser 1
      instances: 1,  // Changer à 'max' si vous utilisez Redis adapter
      exec_mode: 'fork', // Changer à 'cluster' si Redis adapter configuré

      // Redémarrage automatique
      autorestart: true,
      watch: false,
      max_memory_restart: '500M', // Redémarrer si mémoire > 500MB

      // Gestion des erreurs
      min_uptime: '10s',     // Temps min avant de considérer le démarrage réussi
      max_restarts: 10,      // Max 10 redémarrages avant de s'arrêter
      restart_delay: 1000,   // Attendre 1s entre les redémarrages

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,

      // Environnement de production
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Environnement de développement
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
    },
  ],
};
