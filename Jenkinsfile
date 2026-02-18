pipeline {
    agent any

    stages {
        stage('Deploy on server') {
            steps {
                echo '--- Entering stage ---'

                script {
                    def remoteUser = "ubuntu"
                    def remoteHost = "185.113.249.234"
                    def repoPath  = "/home/ubuntu/pesa_plan"

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
                        # NVM should be loaded from bash -l, but ensure it's available
                        export NVM_DIR="\$HOME/.nvm"
                        [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" || {
                            echo "⚠️  Direct NVM load failed, trying profile..."
                            [ -s "\$HOME/.bashrc" ] && source "\$HOME/.bashrc" || true
                            [ -s "\$HOME/.profile" ] && source "\$HOME/.profile" || true
                            [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" || {
                                echo "❌ Failed to load NVM"
                                exit 1
                            }
                        }

                        # Use direct path to avoid alias resolution issues
                        # Node 24.13.0 is installed, use it directly via PATH
                        export PATH="\$NVM_DIR/versions/node/v24.13.0/bin:\$PATH"
                        
                        echo "🔍 Node versions"
                        node -v
                        npm -v
                        echo "Node path: \$(which node)"
                        echo "NPM path: \$(which npm)"
                        
                        # Verify Node version is correct
                        NODE_VERSION=\$(node -v)
                        if [[ "\$NODE_VERSION" != "v24.13.0" ]]; then
                            echo "⚠️  Node version mismatch: \$NODE_VERSION (expected v24.13.0)"
                            echo "Trying alternative method..."
                            # Fallback: try to find and use the installed version
                            if [ -d "\$NVM_DIR/versions/node/v24.13.0" ]; then
                                export PATH="\$NVM_DIR/versions/node/v24.13.0/bin:\$PATH"
                            elif [ -d "\$NVM_DIR/versions/node/v24.13.0" ]; then
                                # Try without 'v' prefix
                                export PATH="\$NVM_DIR/versions/node/24.13.0/bin:\$PATH"
                            else
                                echo "❌ Node 24.13.0 not found in expected location"
                                echo "Available Node installations:"
                                ls -la "\$NVM_DIR/versions/node/" 2>/dev/null || echo "No node versions directory found"
                                exit 1
                            fi
                            node -v
                            npm -v
                        fi

                        npm install
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
                        sudo supervisorctl restart uvi-pesa-plan

                        echo "🎉 Deployment completed successfully"

                    """
                }
            }
        }
    }
}