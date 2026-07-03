pipeline {
    agent any
    
    stages {
        stage('Clone the repo on server') {
            steps {
                echo '--- Entering stage ---'
                script {
                    echo '--- Inside script block ---'
                    // define server details
                    def remoteUser = "ubuntu"
                    def remoteHost = "31.220.86.209"
                    def repoUrl = "git@github.com:azwdevops/life-plan.git"
                    def repoPath = "/home/ubuntu/life_plan"

                    // ssh command - improved with error handling and logging
                    def sshCommand = """
                        echo '✅ SSH to server works'

                        set -e  # Exit immediately if any command fails

                        echo '📁 Navigating to project directory...'

                        cd ${repoPath} || { echo "Failed to cd to ${repoPath}"; exit 1; }

                        echo '⬇️ Pulling latest changes...'
                        
                        git pull github master

                        echo '📦 Installing dependencies...'s
                        
                        source .venv/bin/activate

                        pip3 install -r requirements.txt

                        cd server

                        alembic upgrade head

                        deactivate

                        echo "📦 Frontend setup"
                        cd ../client

                        # Install all deps including dev (needed for next build; NODE_ENV=production skips devDependencies)
                        npm install --include=dev

                        npm run build

                        echo "🚀 Restarting PM2"

                        pm2 startOrReload ecosystem.config.js --env production

                        echo '🚀 Restarting services...'
                        
                        sudo -n supervisorctl restart nginx-main
                        sudo -n supervisorctl restart uvi-life-plan

                        echo '✅ Deployment completed successfully.'
                    """

                    // run ssh command via jenkins with proper quoting

                    sh """
                        ssh -t -i /var/lib/jenkins/.ssh/jenkins_to_contabo_server \
                        -o StrictHostKeyChecking=no ${remoteUser}@${remoteHost} '
                        ${sshCommand}
                    '
                    """
                }
            }
        }
    }
}