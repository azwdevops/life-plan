pipeline {
    agent any

    stages {
        stage('Deploy on server') {
            steps {
                echo '--- Entering stage ---'

                script {
                    def remoteUser = "ubuntu"
                    def remoteHost = "185.113.249.234"
                    def repoPath  = "/home/ubuntu/life_plan"

                    sh """
                        ssh -i /var/lib/jenkins/.ssh/jenkins_to_truehost_server \
                        -o StrictHostKeyChecking=no ${remoteUser}@${remoteHost} bash -l << 'EOF'

                        set -e

                        echo "✅ SSH connected"
                        echo "📁 Moving to project directory"
                        cd ${repoPath}

                        echo "⬇️ Pulling latest changes"
                        GIT_SSH_COMMAND="ssh -i ~/.ssh/truehost_to_github_connect -o IdentitiesOnly=yes" \
                          git pull github master

                        echo "📦 Frontend setup"
                        cd client

                        echo "🔧 Loading NVM"
                        export NVM_DIR="\$HOME/.nvm"
                        [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" || {
                            echo "⚠️ Direct NVM load failed, trying profile..."
                            [ -s "\$HOME/.bashrc" ] && source "\$HOME/.bashrc" || true
                            [ -s "\$HOME/.profile" ] && source "\$HOME/.profile" || true
                            [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" || {
                                echo "❌ Failed to load NVM"
                                exit 1
                            }
                        }

                        # Make sure Node 20 exists
                        if [ ! -d "\$NVM_DIR/versions/node/v20.20.0" ]; then
                            echo "❌ Node 20 not installed. Installing..."
                            nvm install 20
                        fi

                        # Explicitly activate Node 20
                        export PATH="\$NVM_DIR/versions/node/v20.20.0/bin:\$PATH"

                        # Verify
                        echo "🔍 Node versions"
                        node -v
                        npm -v
                        echo "Node path: \$(which node)"
                        echo "NPM path: \$(which npm)"

                        # Install all deps including dev (needed for next build; NODE_ENV=production skips devDependencies)
                        npm install --include=dev
                        npm run build

                        echo "🚀 Restarting PM2"
                        pm2 startOrReload ecosystem.config.js --env production

                        cd ..

                        echo "🐍 Backend dependencies"
                        source .venv/bin/activate
                        pip install -r requirements.txt

                        cd server

                        alembic upgrade head

                        deactivate

                        echo "🔁 Restarting services"
                        sudo supervisorctl restart nginx-main
                        sudo supervisorctl restart uvi-life-plan

                        echo "🎉 Deployment completed successfully"

EOF
                    """
                }
            }
        }
    }
}